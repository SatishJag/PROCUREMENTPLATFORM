"""Procure.AI API. Mounts the shared procurement_core module; the product UI talks to these routes."""

from fastapi import FastAPI

from procurement_core.api import router

app = FastAPI(title="Procure.AI API", version="0.1.0")
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
