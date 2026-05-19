from app.llm.claude import decompose


def test_decompose_fallback_splits_compound_project(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_API_KEY", raising=False)

    subtasks = decompose(
        "Build a React dashboard with user auth (OAuth), real-time charts using D3, "
        "database migrations for Postgres, and deploy to Vercel. Support dark mode."
    )

    titles = [task["title"] for task in subtasks]

    assert "Build a React dashboard" in titles
    assert "Implement user authentication" in titles
    assert "Build real-time charting" in titles
    assert "Add Postgres database migrations" in titles
    assert "Deploy the app to Vercel" in titles
    assert "Add dark mode support" in titles
