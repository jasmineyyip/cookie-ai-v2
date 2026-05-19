from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import projects
from app.core.config import FRONTEND_ORIGINS


def create_app():
    app = FastAPI(title="Cookie AI - Backend")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(projects.router, prefix="/api")

    @app.get("/")
    async def health_check():
        return {"status": "ok", "service": "cookie-ai-backend"}

    return app


app = create_app()
