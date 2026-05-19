import os
from dotenv import load_dotenv

load_dotenv()

# Default to a local SQLite dev DB when DATABASE_URL is not provided to avoid
# requiring a running Postgres instance for early local development.
DATABASE_URL = os.getenv(
	"DATABASE_URL",
	"sqlite+aiosqlite:///./dev.db",
)
CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY", "")
