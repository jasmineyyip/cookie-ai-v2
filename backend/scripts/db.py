import asyncio

from app.db.session import engine
from app.db.base import Base


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created (or already exist)")


if __name__ == "__main__":
    asyncio.run(main())
import asyncio
from app.db.session import engine
from app.db.base import Base


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(create_tables())
