from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from openai import OpenAI
import os
import requests
from urllib.parse import urlencode

app = FastAPI()

google_tokens = {}

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = "https://smart-reviews.onrender.com/auth/google/callback"
GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage"

FRONTEND_URL = "https://smartreviews-mcjc.onrender.com"

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    review: str
    rating: int
    reviewer: str


class ApproveRequest(BaseModel):
    review_id: str
    reply: str


class PostReplyRequest(BaseModel):
    account_id: str
    location_id: str
    review_id: str
    reply: str


@app.get("/")
def home():
    return {
        "message": "Smart Reviews backend is alive"
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
def generate_reply(data: ReviewRequest):
    try:
        review_text = data.review.strip()

        if not review_text:
            review_text = (
                "The reviewer left a star rating "
                "without a written comment."
            )

        prompt = f"""
You write Google Business Profile review replies for a healthcare business.

Create ONE reply to the review below.

Reviewer:
{data.reviewer}

Rating:
{data.rating} out of 5 stars

Review:
{review_text}

Rules:
- Return only the final reply.
- Keep it between 20 and 60 words.
- Sound natural, warm and professional.
- Do not sound like a generic customer-service template.
- Refer naturally to a specific detail from the written review when possible.
- You may use the reviewer's first name when it sounds natural, but do not force it.
- Vary sentence structure and wording.
- Do not invent facts.
- Do not claim that an issue has been fixed unless the review says so.
- Do not discuss diagnoses, treatment, medical history, test results or other private medical information.
- Do not confirm that the reviewer was a patient.
- Do not use emojis.
- Do not use placeholders.
- Do not mention AI.
- Avoid phrases such as "Thank you for your kind words" when more specific wording is available.

Rating-specific tone:

5 stars:
- Warm and appreciative.
- Acknowledge what the reviewer specifically valued.
- Keep the response concise.

4 stars:
- Appreciative and positive.
- Acknowledge both positive feedback and any minor concern if one is mentioned.

3 stars:
- Acknowledge the mixed experience.
- Be polite and receptive.
- Express that the feedback is useful.

1 or 2 stars:
- Be calm, empathetic and non-defensive.
- Acknowledge the concern without arguing.
- Do not admit negligence, wrongdoing or liability.
- Do not discuss private details publicly.
- When appropriate, invite the reviewer to contact the organisation directly so the concern can be understood better.

No written comment:
- Thank the reviewer briefly for taking the time to leave a rating.
- Do not invent a reason for the rating.

Write the reply now.
"""

        response = client.responses.create(
            model="openai/gpt-oss-20b",
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
def approve_reply(data: ApproveRequest):
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
def post_reply(data: PostReplyRequest):
    if not data.account_id or not data.location_id:
        return {
            "error": (
                "Google Business Profile account "
                "and location are required before posting."
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

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": (
                "Google account is not connected. "
                "Reconnect Google Business Profile."
            )
        }

    response = requests.put(
        (
            "https://mybusiness.googleapis.com/v4/"
            f"accounts/{data.account_id}/"
            f"locations/{data.location_id}/"
            f"reviews/{data.review_id}/reply"
        ),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={
            "comment": data.reply.strip()
        },
        timeout=30,
    )

    try:
        result = response.json()
    except Exception:
        result = {
            "message": response.text
        }

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
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(params)
    )

    return RedirectResponse(auth_url)


@app.get("/auth/google/callback")
def google_callback(code: str):
    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )

    tokens = token_response.json()

    if token_response.status_code != 200:
        return {
            "error": "Token exchange failed",
            "details": tokens,
        }

    google_tokens["access_token"] = tokens.get(
        "access_token"
    )

    if tokens.get("refresh_token"):
        google_tokens["refresh_token"] = tokens.get(
            "refresh_token"
        )

    return RedirectResponse(
        f"{FRONTEND_URL}/?connected=true"
    )


@app.get("/google/accounts")
def get_google_accounts():
    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        timeout=30,
    )

    try:
        data = response.json()
    except Exception:
        data = {
            "message": response.text
        }

    if response.status_code != 200:
        return {
            "error": data
        }

    return data


@app.get("/google/locations/{account_id}")
def get_google_locations(account_id: str):
    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        (
            "https://mybusinessbusinessinformation.googleapis.com/"
            f"v1/accounts/{account_id}/locations"
        ),
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "readMask": (
                "name,title,storefrontAddress"
            )
        },
        timeout=30,
    )

    try:
        data = response.json()
    except Exception:
        data = {
            "message": response.text
        }

    if response.status_code != 200:
        return {
            "error": data
        }

    return data


def fetch_google_reviews(
    access_token: str,
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

        response = requests.get(
            (
                "https://mybusiness.googleapis.com/v4/"
                f"accounts/{account_id}/"
                f"locations/{location_id}/reviews"
            ),
            headers={
                "Authorization": (
                    f"Bearer {access_token}"
                )
            },
            params=params,
            timeout=30,
        )

        try:
            data = response.json()
        except Exception:
            data = {
                "message": response.text
            }

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
):
    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    reviews, error = fetch_google_reviews(
        access_token,
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
):
    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    reviews, error = fetch_google_reviews(
        access_token,
        account_id,
        location_id,
    )

    if error:
        return {
            "error": error
        }

    formatted_reviews = []

    rating_map = {
        "ONE": 1,
        "TWO": 2,
        "THREE": 3,
        "FOUR": 4,
        "FIVE": 5,
    }

    for review in reviews:
        raw_rating = review.get(
            "starRating",
            0
        )

        if isinstance(raw_rating, str):
            rating = rating_map.get(
                raw_rating,
                0,
            )
        else:
            rating = int(
                raw_rating or 0
            )

        formatted_reviews.append(
            {
                "id": review.get(
                    "reviewId"
                ),
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