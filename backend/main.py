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


# --------------------------------------------------
# ENVIRONMENT VARIABLES
# --------------------------------------------------

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

GOOGLE_REDIRECT_URI = (
    "https://smart-reviews.onrender.com/auth/google/callback"
)

GOOGLE_SCOPE = (
    "https://www.googleapis.com/auth/business.manage"
)


# --------------------------------------------------
# GROQ AI
# --------------------------------------------------

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smartreviews-mcjc.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATA MODELS
# --------------------------------------------------

class ReviewRequest(BaseModel):
    review: str
    rating: int

class ApproveRequest(BaseModel):
    review_id: str
    reply: str


class PostReplyRequest(BaseModel):
    account_id: str
    location_id: str
    review_id: str
    reply: str


# --------------------------------------------------
# BASIC ROUTES
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Smart Reviews backend is alive"
    }


# --------------------------------------------------
# MOCK REVIEWS
# --------------------------------------------------

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
                "review": (
                    "Good experience overall, but the waiting "
                    "time was a little long."
                ),
            },
            {
                "id": "3",
                "reviewer": "Arjun",
                "rating": 5,
                "review": (
                    "The doctor explained everything clearly "
                    "and the staff was kind."
                ),
            },
        ]
    }


# --------------------------------------------------
# AI REPLY GENERATION
# --------------------------------------------------

@app.post("/generate-reply")
def generate_reply(data: ReviewRequest):
    try:
        review_text = data.review.strip()

        if not review_text:
            review_text = "The customer left a rating without a written comment."

        response = client.responses.create(
            model="openai/gpt-oss-20b",
            input=f"""
You write Google Business Profile review replies for a healthcare business.

Your job:
- Write a short, natural, professional reply.
- Keep it under 60 words.
- Do not invent facts.
- Do not mention diagnoses, treatments, medical conditions, or private patient information.
- Do not sound robotic or repetitive.
- Do not use placeholders.
- Do not use emojis.
- Return only the reply text.

Tone rules:
- 5 stars: warm, appreciative, concise.
- 4 stars: appreciative, positive, slightly reserved.
- 3 stars: polite, acknowledge the mixed experience, invite improvement.
- 1–2 stars: calm, empathetic, non-defensive, avoid admitting fault, invite the reviewer to contact the business directly.
- If there is no written comment, thank them briefly for their feedback/rating.

Rating: {data.rating} stars

Review:
{review_text}
"""
        )

        return {
            "reply": response.output_text.strip()
        }

    except Exception as e:
        return {"error": str(e)}

# --------------------------------------------------
# APPROVAL
# --------------------------------------------------

@app.post("/approve-reply")
def approve_reply(data: ApproveRequest):
    return {
        "status": "approved",
        "review_id": data.review_id,
        "reply": data.reply,
    }


# --------------------------------------------------
# POST REPLY
# --------------------------------------------------

@app.post("/post-reply")
def post_reply(data: PostReplyRequest):

    # Demo mode until Google API access is approved
    if not data.account_id or not data.location_id:
        return {
            "status": "posted",
            "review_id": data.review_id,
            "mode": "demo",
        }

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
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
            "comment": data.reply
        },
    )

    result = response.json()

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


# --------------------------------------------------
# GOOGLE OAUTH LOGIN
# --------------------------------------------------

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


# --------------------------------------------------
# GOOGLE OAUTH CALLBACK
# --------------------------------------------------

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

    google_tokens["refresh_token"] = tokens.get(
        "refresh_token"
    )

    return RedirectResponse(
    "https://smartreviews-mcjc.onrender.com/?connected=true"
    )


# --------------------------------------------------
# GOOGLE ACCOUNTS
# --------------------------------------------------

@app.get("/google/accounts")
def get_google_accounts():

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        (
            "https://"
            "mybusinessaccountmanagement.googleapis.com/"
            "v1/accounts"
        ),
        headers={
            "Authorization": f"Bearer {access_token}"
        },
    )

    return response.json()


# --------------------------------------------------
# GOOGLE LOCATIONS
# --------------------------------------------------

@app.get("/google/locations/{account_id}")
def get_google_locations(account_id: str):

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        (
            "https://"
            "mybusinessbusinessinformation.googleapis.com/"
            f"v1/accounts/{account_id}/locations"
        ),
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "readMask": "name,title,storefrontAddress"
        },
    )

    return response.json()


# --------------------------------------------------
# RAW GOOGLE REVIEWS
# --------------------------------------------------

@app.get("/google/reviews/{account_id}/{location_id}")
def get_google_reviews(
    account_id: str,
    location_id: str
):

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        (
            "https://mybusiness.googleapis.com/v4/"
            f"accounts/{account_id}/"
            f"locations/{location_id}/reviews"
        ),
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "pageSize": 50
        },
    )

    return response.json()


# --------------------------------------------------
# GOOGLE REVIEWS FORMATTED FOR DASHBOARD
# --------------------------------------------------

@app.get("/reviews/{account_id}/{location_id}")
def get_reviews_for_dashboard(
    account_id: str,
    location_id: str
):

    access_token = google_tokens.get("access_token")

    if not access_token:
        return {
            "error": "Google account not connected"
        }

    response = requests.get(
        (
            "https://mybusiness.googleapis.com/v4/"
            f"accounts/{account_id}/"
            f"locations/{location_id}/reviews"
        ),
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "pageSize": 50
        },
    )

    data = response.json()

    if response.status_code != 200:
        return data

    formatted_reviews = []

    for review in data.get("reviews", []):
        formatted_reviews.append(
            {
                "id": review.get("reviewId"),
                "reviewer": review.get(
                    "reviewer",
                    {}
                ).get(
                    "displayName",
                    "Anonymous"
                ),
                "rating": review.get(
                    "starRating"
                ),
                "review": review.get(
                    "comment",
                    ""
                ),
            }
        )

    return {
        "reviews": formatted_reviews
    }