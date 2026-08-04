from fastapi import FastAPI
app = FastAPI()
@app.get("/")
def home():
    return{
        "message":"our AI copilot backend is alive"
    }