# backend

Tiny FastAPI backend scaffold for Cookie AI.

Quick start

```bash
# create venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# run dev server
uvicorn app.main:app --reload --factory --port 8000
```

This commit adds models, basic routes (stubs), and schema definitions.
