import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_session
from app.main import create_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_create_project_returns_decomposed_subtasks(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_API_KEY", raising=False)

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app = create_app()
    app.dependency_overrides[get_session] = override_get_session

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/projects",
                json={
                    "title": "Launch SaaS dashboard",
                    "instructions": (
                        "Build a React dashboard with user auth (OAuth), "
                        "real-time charts using D3, database migrations for Postgres, "
                        "and deploy to Vercel. Support dark mode."
                    ),
                },
            )
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()

    assert response.status_code == 200
    data = response.json()
    titles = [task["title"] for task in data["subtasks"]]

    assert data["status"] == "ready"
    assert "Build a React dashboard" in titles
    assert "Implement user authentication" in titles
    assert "Build real-time charting" in titles
    assert "Add Postgres database migrations" in titles
    assert "Deploy the app to Vercel" in titles
    assert "Add dark mode support" in titles
