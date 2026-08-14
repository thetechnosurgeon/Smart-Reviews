from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse

app = FastAPI()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

GOOGLE_REDIRECT_URI = "https://smart-reviews.onrender.com/auth/google/callback"

GOOGLE_SCOPE = "https://www.googleapis.com/auth/business.manage"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ReviewRequest(BaseModel):
    review:str

@app.get("/")
def home():
    return{"message":"our ai copilot backend is alive"}

@app.post("/generate-reply")
def generate_reply(data: ReviewRequest):

    ollama_response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "gemma3:1b",
            "prompt": (
                "Write a short, warm, professional reply to this patient review. "
                "Do not invent facts. Keep it under 60 words. dont include placeholders. \n\n"
                f"Review: {data.review}"
            ),
            "stream": False,
        },
    )

    result = ollama_response.json()

    return {
        "reply": result["response"]
    }
@app.get("/auth/google")
def google_login():

    params = {
        "client_id": GOOGLE_CLIENT_ID, 
        "redirect_uri": GOOGLE_REDIRECT_URI, 
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/business.manage",
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)

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

    return tokens