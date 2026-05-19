import asyncio

from app.db.session import engine
from app.db.base import Base
# import all models to register them with Base.metadata
from app.db.models import User, Project, Subtask  # noqa: F401


async def main():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Tables created")
    except Exception as e:
        print(f"✗ Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
