import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_session
from app.main import create_app


PROJECT_PAYLOAD = {
    "title": "Launch SaaS dashboard",
    "instructions": (
        "Build a React dashboard with user auth (OAuth), "
        "real-time charts using D3, database migrations for Postgres, "
        "and deploy to Vercel. Support dark mode."
    ),
}

EXPECTED_TITLES = {
    "Build a React dashboard",
    "Implement user authentication",
    "Build real-time charting",
    "Add Postgres database migrations",
    "Deploy the app to Vercel",
    "Add dark mode support",
}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def api_client(monkeypatch):
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
            yield client
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_create_project_returns_decomposed_subtasks(api_client):
    response = await api_client.post("/api/projects", json=PROJECT_PAYLOAD)

    assert response.status_code == 200
    data = response.json()
    titles = [task["title"] for task in data["subtasks"]]

    assert data["status"] == "ready"
    assert EXPECTED_TITLES.issubset(titles)


@pytest.mark.anyio
async def test_phase_one_project_api_surface(api_client):
    create_response = await api_client.post("/api/projects", json=PROJECT_PAYLOAD)
    assert create_response.status_code == 200
    project = create_response.json()
    project_id = project["id"]
    first_subtask = project["subtasks"][0]

    list_response = await api_client.get("/api/projects")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [project_id]

    get_response = await api_client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == project_id

    patch_response = await api_client.patch(
        f"/api/subtasks/{first_subtask['id']}",
        json={
            "title": "Build dashboard shell",
            "estimated_minutes": 45,
            "status": "in_progress",
            "position": 2,
        },
    )
    assert patch_response.status_code == 200
    updated_subtask = patch_response.json()
    assert updated_subtask["title"] == "Build dashboard shell"
    assert updated_subtask["estimated_minutes"] == 45
    assert updated_subtask["status"] == "in_progress"
    assert updated_subtask["position"] == 2

    delete_response = await api_client.delete(f"/api/subtasks/{first_subtask['id']}")
    assert delete_response.status_code == 204

    missing_subtask_response = await api_client.patch(
        f"/api/subtasks/{first_subtask['id']}",
        json={"status": "done"},
    )
    assert missing_subtask_response.status_code == 404

    redecompose_response = await api_client.post(f"/api/projects/{project_id}/redecompose")
    assert redecompose_response.status_code == 200
    redecomposed_project = redecompose_response.json()
    redecomposed_titles = {task["title"] for task in redecomposed_project["subtasks"]}

    assert redecomposed_project["status"] == "ready"
    assert EXPECTED_TITLES.issubset(redecomposed_titles)

    missing_project_response = await api_client.post("/api/projects/not-a-real-id/redecompose")
    assert missing_project_response.status_code == 404
