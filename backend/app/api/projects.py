from fastapi import APIRouter, HTTPException
from typing import Dict, List
from uuid import uuid4
from app.schemas import ProjectCreate, ProjectRead, SubtaskRead
import datetime

router = APIRouter()

# In-memory store for initial dev convenience (replace with DB in next PR)
_projects: Dict[str, Dict] = {}


@router.post("/projects", response_model=ProjectRead)
async def create_project(payload: ProjectCreate):
    pid = uuid4()
    project = {
        "id": pid,
        "title": payload.title,
        "raw_instructions": payload.instructions,
        "status": "decomposing",
        "created_at": datetime.datetime.utcnow(),
        "subtasks": [],
    }
    # store simple in-memory record
    _projects[str(pid)] = project
    return project


@router.get("/projects", response_model=List[ProjectRead])
async def list_projects():
    return list(_projects.values())


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
