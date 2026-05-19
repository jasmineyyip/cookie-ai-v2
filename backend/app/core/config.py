import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/cookieai")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
