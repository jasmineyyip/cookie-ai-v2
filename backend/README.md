# Cookie AI Backend

FastAPI backend for projects, task decomposition, and persistence.

## Set up

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/cookieai
ANTHROPIC_API_KEY=your_key_here
```

Run migrations:

```bash
PYTHONPATH=. alembic upgrade head
```

Start the API:

```bash
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

Smoke test project decomposition:

```bash
curl -s -X POST http://localhost:8000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"title":"Launch SaaS dashboard","instructions":"Build a React dashboard with user auth (OAuth), real-time charts using D3, database migrations for Postgres, and deploy to Vercel. Support dark mode."}' | jq
```

Run tests:

```bash
PYTHONPATH=. pytest
```
