from fastapi import APIRouter, HTTPException, Depends
from typing import List
from uuid import uuid4
from app.schemas import ProjectCreate, ProjectRead
import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import Project as ProjectModel, User as UserModel, Subtask as SubtaskModel
from app.llm.claude import decompose

router = APIRouter()


@router.post("/projects", response_model=ProjectRead)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_session)):
    # create or find a dev user for initial dev flow (replace with Clerk integration later)
    q = select(UserModel).where(UserModel.clerk_user_id == "dev")
    res = await db.execute(q)
    user = res.scalars().first()
    if not user:
        user = UserModel(clerk_user_id="dev", email="dev@local")
        db.add(user)
        await db.flush()

    project = ProjectModel(
        user_id=user.id,
        title=payload.title,
        raw_instructions=payload.instructions,
        status="decomposing",
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    # run the decomposition synchronously for now
    try:
        items = decompose(payload.instructions or payload.title or "")
        for idx, it in enumerate(items):
            st = SubtaskModel(
                project_id=project.id,
                title=it.get("title") or f"Step {idx+1}",
                description=it.get("description"),
                estimated_minutes=it.get("estimated_minutes", 30),
                difficulty=it.get("difficulty", "medium"),
                status="todo",
                position=idx,
                order_index=idx,
            )
            db.add(st)
        project.status = "ready"
        await db.flush()
    except Exception:
        project.status = "failed"
    await db.refresh(project)
    return project


@router.get("/projects", response_model=List[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_session)):
    q = select(ProjectModel)
    res = await db.execute(q)
    projects = res.scalars().all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(project_id: str, db: AsyncSession = Depends(get_session)):
    q = select(ProjectModel).where(ProjectModel.id == project_id)
    res = await db.execute(q)
    project = res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
