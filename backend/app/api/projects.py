from fastapi import APIRouter, HTTPException, Depends, Response, status
from typing import List
from uuid import UUID
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate, SubtaskCreate, SubtaskRead, SubtaskUpdate, SubtaskReorderItem
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_session
from app.db.models import Project as ProjectModel, User as UserModel, Subtask as SubtaskModel
from app.llm.claude import decompose, split_subtask

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_uuid(value: str, resource_name: str):
    if isinstance(value, UUID):
        return value

    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"{resource_name} not found")


async def _get_project_with_subtasks(db: AsyncSession, project_id: str):
    parsed_project_id = _parse_uuid(project_id, "Project")
    q = (
        select(ProjectModel)
        .where(ProjectModel.id == parsed_project_id)
        .options(selectinload(ProjectModel.subtasks))
        .execution_options(populate_existing=True)
    )
    res = await db.execute(q)
    return res.scalars().first()


def _create_subtasks(project: ProjectModel, items: List[dict], db: AsyncSession):
    for idx, item in enumerate(items):
        subtask = SubtaskModel(
            project_id=project.id,
            title=item.get("title") or f"Step {idx + 1}",
            description=item.get("description"),
            estimated_minutes=item.get("estimated_minutes", 30),
            difficulty=item.get("difficulty", "medium"),
            status="todo",
            position=idx,
            order_index=idx,
        )
        db.add(subtask)


async def _decompose_project(project: ProjectModel, db: AsyncSession):
    try:
        if not project.raw_instructions or not project.raw_instructions.strip():
            project.status = "ready"
            return

        items = decompose(project.raw_instructions)
        if not items:
            raise ValueError("Decomposition returned no subtasks")

        _create_subtasks(project, items, db)
        project.status = "ready"
    except Exception:
        logger.exception("Project decomposition failed for project %s", project.id)
        project.status = "failed"


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
        raw_instructions=payload.instructions or None,
        status="ready",
    )
    db.add(project)
    await db.flush()

    return await _get_project_with_subtasks(db, project.id)


@router.get("/projects", response_model=List[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_session)):
    q = select(ProjectModel).options(selectinload(ProjectModel.subtasks))
    res = await db.execute(q)
    projects = res.scalars().all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(project_id: str, db: AsyncSession = Depends(get_session)):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_session),
):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(project, field, value)

    await db.flush()
    return await _get_project_with_subtasks(db, project_id)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_session)):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/projects/{project_id}/subtasks", response_model=SubtaskRead)
async def create_subtask(
    project_id: str,
    payload: SubtaskCreate,
    db: AsyncSession = Depends(get_session),
):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    subtask = SubtaskModel(
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        estimated_minutes=payload.estimated_minutes,
        difficulty=payload.difficulty,
        status="todo",
        position=len(project.subtasks),
        order_index=len(project.subtasks),
    )
    db.add(subtask)
    await db.flush()
    return subtask


@router.post("/projects/{project_id}/redecompose", response_model=ProjectRead)
async def redecompose_project(project_id: str, db: AsyncSession = Depends(get_session)):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for subtask in project.subtasks:
        await db.delete(subtask)

    project.status = "decomposing"
    await db.flush()

    await _decompose_project(project, db)
    await db.flush()

    return await _get_project_with_subtasks(db, project_id)


@router.patch("/subtasks/{subtask_id}", response_model=SubtaskRead)
async def update_subtask(
    subtask_id: str,
    payload: SubtaskUpdate,
    db: AsyncSession = Depends(get_session),
):
    parsed_subtask_id = _parse_uuid(subtask_id, "Subtask")
    q = select(SubtaskModel).where(SubtaskModel.id == parsed_subtask_id)
    res = await db.execute(q)
    subtask = res.scalars().first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(subtask, field, value)

    await db.flush()
    return subtask


@router.post("/projects/{project_id}/subtasks/reorder", response_model=ProjectRead)
async def reorder_subtasks(
    project_id: str,
    payload: List[SubtaskReorderItem],
    db: AsyncSession = Depends(get_session),
):
    project = await _get_project_with_subtasks(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    id_to_position = {item.id: item.position for item in payload}
    for subtask in project.subtasks:
        new_pos = id_to_position.get(str(subtask.id))
        if new_pos is not None:
            subtask.position = new_pos
            subtask.order_index = new_pos

    await db.flush()
    return await _get_project_with_subtasks(db, project_id)


@router.post("/subtasks/{subtask_id}/split", response_model=ProjectRead)
async def split_subtask_endpoint(subtask_id: str, db: AsyncSession = Depends(get_session)):
    parsed_subtask_id = _parse_uuid(subtask_id, "Subtask")
    q = select(SubtaskModel).where(SubtaskModel.id == parsed_subtask_id)
    res = await db.execute(q)
    subtask = res.scalars().first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    project = await _get_project_with_subtasks(db, str(subtask.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_items = split_subtask(
        title=subtask.title,
        description=subtask.description or "",
        estimated_minutes=subtask.estimated_minutes,
        difficulty=subtask.difficulty,
        project_context=project.raw_instructions or project.title,
    )

    insert_position = subtask.position
    for s in project.subtasks:
        if s.position >= insert_position and s.id != subtask.id:
            s.position += 2
            s.order_index += 2

    for offset, item in enumerate(new_items):
        new_subtask = SubtaskModel(
            project_id=project.id,
            title=item.get("title", f"{subtask.title} (Part {offset + 1})"),
            description=item.get("description"),
            estimated_minutes=item.get("estimated_minutes", max(5, subtask.estimated_minutes // 2)),
            difficulty=item.get("difficulty", subtask.difficulty),
            status="todo",
            position=insert_position + offset,
            order_index=insert_position + offset,
        )
        db.add(new_subtask)

    await db.delete(subtask)
    await db.flush()

    return await _get_project_with_subtasks(db, str(project.id))


@router.delete("/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subtask(subtask_id: str, db: AsyncSession = Depends(get_session)):
    parsed_subtask_id = _parse_uuid(subtask_id, "Subtask")
    q = select(SubtaskModel).where(SubtaskModel.id == parsed_subtask_id)
    res = await db.execute(q)
    subtask = res.scalars().first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    await db.delete(subtask)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
