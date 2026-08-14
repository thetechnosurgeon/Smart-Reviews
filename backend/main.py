from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from fastapi.responses import RedirectResponse

app = FastAPI()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

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

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        f"&scope={GOOGLE_SCOPE}"
        "&access_type=offline"
        "&prompt=consent"
    )

    return RedirectResponse(auth_url)
print("GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID)