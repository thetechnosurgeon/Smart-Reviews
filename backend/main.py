import logging
import os
import re
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from openai import OpenAI
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

import db
import google_auth
import security

logger = logging.getLogger("smartrepute")

# Where this API is reachable, and where the website lives.
API_BASE_URL = os.getenv(
    "API_BASE_URL", "https://smart-reviews.onrender.com"
).rstrip("/")

FRONTEND_URL = os.getenv(
    "FRONTEND_URL", "https://www.smartrepute.com"
).rstrip("/")

OLD_FRONTEND_URL = "https://smartreviews-mcjc.onrender.com"

# Login cookies. "lax" is right once the API lives on a subdomain of the
# same site as the website (api.smartrepute.com). Only use "none" as a
# temporary fallback while the API is still on onrender.com.
SESSION_COOKIE = "sr_session"
STATE_COOKIE = "sr_oauth_state"

COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()

if COOKIE_SAMESITE not in ("lax", "none"):
    COOKIE_SAMESITE = "lax"

COOKIE_SECURE = (
    API_BASE_URL.startswith("https://") or COOKIE_SAMESITE == "none"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        db.init_db()
    except Exception:
        logger.exception("Could not initialise the database")

    if not security.secret_is_configured():
        logger.error(
            "APP_SECRET is missing or shorter than 32 characters. "
            "Sign-in will not work until it is set."
        )

    yield


app = FastAPI(lifespan=lifespan)

RATING_MAP = {
    "ONE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
    "FIVE": 5,
}


def normalize_rating(raw_rating) -> int:
    if isinstance(raw_rating, str):
        return RATING_MAP.get(raw_rating.strip().upper(), 0)

    try:
        return int(raw_rating or 0)
    except (TypeError, ValueError):
        return 0


# The AI provider is configurable from the server's environment so it
# can be switched without a code change.
AI_MODEL = os.getenv("AI_MODEL", "openai/gpt-oss-20b")

client = OpenAI(
    api_key=os.getenv("AI_API_KEY") or os.getenv("GROQ_API_KEY"),
    base_url=os.getenv(
        "AI_BASE_URL", "https://api.groq.com/openai/v1"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        FRONTEND_URL,
        "https://smartrepute.com",
        OLD_FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Every error the frontend sees keeps the same {"error": ...} shape.
@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        {"error": exc.detail}, status_code=exc.status_code
    )


@app.exception_handler(google_auth.GoogleAuthError)
async def google_error_handler(
    request: Request, exc: google_auth.GoogleAuthError
):
    return JSONResponse(
        {"error": exc.message, "code": exc.code},
        status_code=exc.status,
    )


@app.exception_handler(security.SecretNotConfigured)
async def secret_error_handler(
    request: Request, exc: security.SecretNotConfigured
):
    return JSONResponse({"error": str(exc)}, status_code=500)


def current_account(request: Request) -> dict:
    """The signed-in business owner, or a 401."""
    account_id = security.read_session_token(
        request.cookies.get(SESSION_COOKIE)
    )

    account = db.get_account(account_id) if account_id else None

    if not account:
        raise HTTPException(status_code=401, detail="Not signed in")

    return account


def _set_cookie(response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def _clear_cookie(response, key: str) -> None:
    response.delete_cookie(
        key,
        path="/",
        secure=COOKIE_SECURE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
    )


def _json_or_message(response) -> dict:
    try:
        return response.json()
    except Exception:
        return {"message": response.text}


class ReviewRequest(BaseModel):
    review: str
    rating: int
    reviewer: str


class ApproveRequest(BaseModel):
    review_id: str
    reply: str


class ActiveBusinessRequest(BaseModel):
    google_account_id: str
    location_id: str
    title: Optional[str] = None


class PostReplyRequest(BaseModel):
    account_id: str
    location_id: str
    review_id: str
    reply: str


@app.get("/")
def home():
    return {
        "message": "Smart Repute backend is alive"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "database": db.database_label(),
        "app_secret_set": security.secret_is_configured(),
        "google_client_configured": google_auth.client_is_configured(),
    }


@app.get("/reviews")
def get_reviews():
    return {
        "reviews": [
            {
                "id": "1",
                "reviewer": "Rahul",
                "rating": 5,
                "review": "Excellent care and very helpful staff.",
            },
            {
                "id": "2",
                "reviewer": "Priya",
                "rating": 4,
                "review": "Good experience overall, but the waiting time was a little long.",
            },
            {
                "id": "3",
                "reviewer": "Arjun",
                "rating": 5,
                "review": "The doctor explained everything clearly and the staff was kind.",
            },
            {
                "id": "4",
                "reviewer": "Kiran",
                "rating": 2,
                "review": "The waiting time was very long and communication could have been better.",
            },
            {
                "id": "5",
                "reviewer": "Meera",
                "rating": 5,
                "review": "",
            },
        ]
    }


@app.post("/generate-reply")
def generate_reply(
    data: ReviewRequest,
    account: dict = Depends(current_account),
):
    try:
        original_review = data.review.strip()

        has_written_comment = bool(original_review)

        review_text = (
            original_review
            if has_written_comment
            else "NO WRITTEN COMMENT"
        )

        prompt = f"""
You write public Google Business Profile replies for a healthcare organisation.
Write like a real person at this clinic who actually read this specific
review -- not a template that could be pasted under any review anywhere.

Reviewer name:
{data.reviewer}

Rating:
{data.rating} out of 5 stars

Written review:
{review_text}

FIRST, work out the single most specific, concrete thing in this review --
a named doctor or staff member, a specific procedure, a specific complaint,
a specific detail they mentioned. Build your reply around THAT, not around
generic praise or generic sympathy. If there is truly nothing specific (a
short "Good" or no comment), say so plainly rather than inventing detail.

THE DIFFERENCE THIS MAKES:

Review (5 stars): "Dr. Ramesh explained the surgery clearly and the staff were kind."
Too generic -- avoid this: "Thank you for your wonderful review! We're so glad you had a great experience with us."
Specific -- write like this: "So glad Dr. Ramesh took the time to explain everything clearly -- that kind of care from the whole team is exactly what we aim for."

Review (2 stars): "Waited over an hour with no update."
Too generic -- avoid this: "We're sorry for the inconvenience and appreciate your feedback."
Specific -- write like this: "An hour with no update isn't the experience we want for anyone. We're sorry about that wait -- please reach out to us directly so we can look into what happened."

Now write ONE complete reply for the review above, following that same approach.

STRICT FACTUAL RULES:

- Use ONLY information explicitly contained in the review.
- Never infer or invent anything about the organisation.
- Never invent business values, policies, priorities, processes, improvements, actions or commitments.
- Never say the organisation is "working to improve", "improving scheduling", "reducing delays", "committed to excellence", or similar unless that fact was explicitly provided.
- Never claim something has been fixed, changed or investigated.
- Never infer why the reviewer gave their rating.
- If there is NO WRITTEN COMMENT, acknowledge only the rating and the fact that the reviewer took time to leave feedback.
- Do not invent qualities such as attentive care, compassionate care, excellent service, calm environment or professionalism unless the reviewer explicitly said them.

HEALTHCARE PRIVACY RULES:

- Do not confirm that the reviewer was a patient.
- Do not discuss diagnoses, treatment, medical history, medications, investigations or clinical details.
- Do not reveal or infer private medical information.
- For complaints, do not debate the facts publicly.
- Do not admit negligence, wrongdoing or legal liability.

STYLE:

- Return only the final reply.
- 15 to 60 words.
- Natural, warm and professional.
- Concise.
- No emojis.
- No placeholders.
- Do not mention AI.
- Avoid repetitive customer-service phrases such as "we appreciate your feedback" or "thank you for your kind words".
- Do not start every reply the same way -- vary your opening words between replies. Not every reply needs to open with "Thank you".
- You may use the reviewer's first name naturally, but not every reply needs it.
- Vary wording and sentence structure between replies.
- Do NOT reuse the reviewer's exact words or phrases from their review. Restate their point in your own words -- echoing their own sentences back reads as robotic and insincere, even if the words are accurate.

RATING GUIDANCE:

5 stars:
- Thank them.
- If they wrote a comment, acknowledge one specific positive detail they actually mentioned.

4 stars:
- Thank them.
- Acknowledge the positive part and any stated concern without inventing a solution.

3 stars:
- Acknowledge the mixed feedback.
- Thank them for sharing it.
- Do not imply corrective action unless explicitly known.

1 or 2 stars:
- Acknowledge only the concern they actually stated.
- Be calm, empathetic and non-defensive.
- When appropriate, invite them to contact the organisation directly to discuss the concern.
- Do not promise an investigation or improvement.

NO WRITTEN COMMENT:
- Mention only the star rating or thank them for leaving a rating.
- Do not describe what they liked.
- Do not infer anything about their experience.

Write the reply now.
"""

        response = client.responses.create(
            model=AI_MODEL,
            input=prompt,
        )

        reply = response.output_text.strip()

        if not reply:
            return {
                "error": "AI returned an empty reply"
            }

        return {
            "reply": reply
        }

    except Exception as e:
        return {
            "error": str(e)
        }


@app.post("/approve-reply")
def approve_reply(
    data: ApproveRequest,
    account: dict = Depends(current_account),
):
    if not data.reply.strip():
        return {
            "error": "Reply cannot be empty"
        }

    return {
        "status": "approved",
        "review_id": data.review_id,
        "reply": data.reply.strip(),
    }


@app.post("/post-reply")
def post_reply(
    data: PostReplyRequest,
    account: dict = Depends(current_account),
):
    if not data.account_id or not data.location_id:
        return {
            "error": (
                "Google Business Profile account and location "
                "are required before posting."
            )
        }

    if not data.review_id:
        return {
            "error": "Review ID is required"
        }

    if not data.reply.strip():
        return {
            "error": "Reply cannot be empty"
        }

    response = google_auth.google_request(
        account,
        "PUT",
        (
            "https://mybusiness.googleapis.com/v4/"
            f"accounts/{data.account_id}/"
            f"locations/{data.location_id}/"
            f"reviews/{data.review_id}/reply"
        ),
        headers={"Content-Type": "application/json"},
        json={"comment": data.reply.strip()},
    )

    result = _json_or_message(response)

    if response.status_code != 200:
        return {
            "error": "Google reply failed",
            "details": result,
        }

    return {
        "status": "posted",
        "review_id": data.review_id,
        "mode": "google",
    }


@app.get("/auth/google")
def google_login():
    state = security.new_oauth_state()

    response = RedirectResponse(google_auth.build_auth_url(state))

    _set_cookie(response, STATE_COOKIE, state, 600)

    return response


@app.get("/auth/google/callback")
def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    def fail(reason: str):
        response = RedirectResponse(
            f"{FRONTEND_URL}/?auth_error={reason}"
        )
        _clear_cookie(response, STATE_COOKIE)
        return response

    if error or not code:
        return fail("denied")

    if not security.states_match(
        state, request.cookies.get(STATE_COOKIE)
    ):
        return fail("state_mismatch")

    try:
        account = google_auth.complete_login(code)
    except google_auth.GoogleAuthError as exc:
        return fail(exc.code)

    response = RedirectResponse(f"{FRONTEND_URL}/?connected=true")

    _clear_cookie(response, STATE_COOKIE)

    _set_cookie(
        response,
        SESSION_COOKIE,
        security.create_session_token(account["id"]),
        security.SESSION_MAX_AGE,
    )

    return response


@app.get("/me")
def me(account: dict = Depends(current_account)):
    active = db.get_active_business(account["id"])

    return {
        "id": account["id"],
        "email": account["email"],
        "name": account["name"],
        "picture": account["picture"],
        "connected": bool(account["refresh_token_enc"]),
        "active_business": (
            {
                "google_account_id": active["google_account_id"],
                "location_id": active["location_id"],
                "title": active["location_title"],
            }
            if active
            else None
        ),
    }


@app.post("/account/active-business")
def save_active_business(
    data: ActiveBusinessRequest,
    account: dict = Depends(current_account),
):
    """Remembers which business this account is working on."""
    if not (
        re.fullmatch(r"\d{1,30}", data.google_account_id)
        and re.fullmatch(r"\d{1,30}", data.location_id)
    ):
        raise HTTPException(
            status_code=400, detail="Invalid business id"
        )

    db.set_active_business(
        account["id"],
        data.google_account_id,
        data.location_id,
        (data.title or "")[:200] or None,
    )

    return {"status": "saved"}


@app.post("/auth/logout")
def logout():
    response = JSONResponse({"status": "signed_out"})

    _clear_cookie(response, SESSION_COOKIE)

    return response


@app.post("/account/disconnect")
def disconnect_account(account: dict = Depends(current_account)):
    google_auth.disconnect(account)

    response = JSONResponse({"status": "disconnected"})

    _clear_cookie(response, SESSION_COOKIE)

    return response


@app.get("/google/accounts")
def get_google_accounts(account: dict = Depends(current_account)):
    response = google_auth.google_request(
        account,
        "GET",
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    )

    data = _json_or_message(response)

    if response.status_code != 200:
        return {
            "error": data
        }

    return data


@app.get("/google/locations/{account_id}")
def get_google_locations(
    account_id: str,
    account: dict = Depends(current_account),
):
    response = google_auth.google_request(
        account,
        "GET",
        (
            "https://mybusinessbusinessinformation.googleapis.com/"
            f"v1/accounts/{account_id}/locations"
        ),
        params={
            "readMask": "name,title,storefrontAddress"
        },
    )

    data = _json_or_message(response)

    if response.status_code != 200:
        return {
            "error": data
        }

    return data


def fetch_google_reviews(
    account: dict,
    account_id: str,
    location_id: str,
):
    all_reviews = []
    page_token = None

    while True:
        params = {
            "pageSize": 50
        }

        if page_token:
            params["pageToken"] = page_token

        response = google_auth.google_request(
            account,
            "GET",
            (
                "https://mybusiness.googleapis.com/v4/"
                f"accounts/{account_id}/"
                f"locations/{location_id}/reviews"
            ),
            params=params,
        )

        data = _json_or_message(response)

        if response.status_code != 200:
            return None, data

        all_reviews.extend(
            data.get("reviews", [])
        )

        page_token = data.get(
            "nextPageToken"
        )

        if not page_token:
            break

    return all_reviews, None


@app.get("/google/reviews/{account_id}/{location_id}")
def get_google_reviews(
    account_id: str,
    location_id: str,
    account: dict = Depends(current_account),
):
    reviews, error = fetch_google_reviews(
        account,
        account_id,
        location_id,
    )

    if error:
        return {
            "error": error
        }

    return {
        "reviews": reviews
    }


@app.get("/reviews/{account_id}/{location_id}")
def get_reviews_for_dashboard(
    account_id: str,
    location_id: str,
    account: dict = Depends(current_account),
):
    reviews, error = fetch_google_reviews(
        account,
        account_id,
        location_id,
    )

    if error:
        return {
            "error": error
        }

    formatted_reviews = []

    for review in reviews:
        raw_rating = review.get(
            "starRating",
            0
        )

        rating = normalize_rating(raw_rating)

        formatted_reviews.append(
            {
                "id": review.get("reviewId"),
                "reviewer": (
                    review
                    .get("reviewer", {})
                    .get(
                        "displayName",
                        "Anonymous",
                    )
                ),
                "rating": rating,
                "review": review.get(
                    "comment",
                    "",
                ),
                "has_reply": bool(
                    review.get("reviewReply")
                ),
                "existing_reply": (
                    review
                    .get("reviewReply", {})
                    .get(
                        "comment",
                        "",
                    )
                ),
            }
        )

    return {
        "reviews": formatted_reviews
    }