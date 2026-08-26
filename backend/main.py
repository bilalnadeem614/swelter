from fastapi import FastAPI

app = FastAPI(title="Swelter")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
