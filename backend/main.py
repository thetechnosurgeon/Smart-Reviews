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


GOOGLE_REDIRECT_URI = (
    "https://smart-reviews.onrender.com/auth/google/callback"
)

GOOGLE_SCOPE = (
    "https://www.googleapis.com/auth/business.manage"
)

access_token = google_tokens.get("access_token")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smartreviewsapp.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewRequest(BaseModel):
    review: str


class ApproveRequest(BaseModel):
    review_id: str
    reply: str


class PostReplyRequest(BaseModel):
    review_id: str
    reply: str


@app.get("/")
def home():
    return {
        "message": "Our AI copilot backend is alive"
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
        ]
    }


client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)


@app.post("/generate-reply")
def generate_reply(data: ReviewRequest):
    try:
        response = client.responses.create(
            model="openai/gpt-oss-20b",
            input=(
                "Write a short, warm, professional reply "
                "to this customer review. "
                "Do not invent facts. "
                "Keep it under 60 words. "
                "Do not include placeholders. "
                "Return only the reply text.\n\n"
                f"Review: {data.review}"
            ),
        )

        return {
            "reply": response.output_text
        }

    except Exception as e:
        return {
            "error": str(e)
        }

@app.post("/approve-reply")
def approve_reply(data: ApproveRequest):
    return {
        "status": "approved",
        "review_id": data.review_id,
        "reply": data.reply,
    }


@app.post("/post-reply")
def post_reply(data: PostReplyRequest):
    return {
        "status": "posted",
        "review_id": data.review_id,
        "reply": data.reply,
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
    )

    tokens = token_response.json()

    if token_response.status_code != 200:
        return {
            "error": "Token exchange failed",
            "details": tokens,
        }

    google_tokens["access_token"] = tokens.get("access_token")
    google_tokens["refresh_token"] = tokens.get("refresh_token")

    return {
        "message": "Google account connected successfully",
        "has_access_token": bool(
            google_tokens["access_token"]
        ),
        "has_refresh_token": bool(
            google_tokens["refresh_token"]
        ),
    }


@app.get("/google/accounts")
def get_google_accounts():
    access_token = get_google_access_token()

    if not access_token:
        return {
            "error": "Could not get Google access token"
        }

    response = requests.get(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
    )

    return response.json()


@app.get("/google/locations/{account_id}")
def get_google_locations(account_id: str):
    access_token = get_google_access_token()

    if not access_token:
        return {
            "error": "Could not get Google access token"
        }

    response = requests.get(
        f"https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "readMask": "name,title,storefrontAddress"
        },
    )

    return response.json()


@app.get("/google/reviews/{account_id}/{location_id}")
def get_google_reviews(
    account_id: str,
    location_id: str
):
    access_token = get_google_access_token()

    if not access_token:
        return {
            "error": "Could not get Google access token"
        }

    response = requests.get(
        f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        params={
            "pageSize": 50
        },
    )

    return response.json()


@app.get("/reviews/{account_id}/{location_id}")
def get_reviews_for_dashboard(
    account_id: str,
    location_id: str
):
    access_token = get_google_access_token()

    if not access_token:
        return {
            "error": "Could not get Google access token"
        }

    response = requests.get(
        f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews",
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
                "rating": review.get("starRating"),
                "review": review.get("comment", ""),
            }
        )

    return {
        "reviews": formatted_reviews
    }