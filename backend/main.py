from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()


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

