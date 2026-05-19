from fastapi import FastAPI
from app.api import projects


def create_app():
    app = FastAPI(title="Cookie AI - Backend")
    app.include_router(projects.router, prefix="/api")
    return app


app = create_app()
