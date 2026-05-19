from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID
import datetime


class SubtaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_minutes: int
    difficulty: str


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskRead(SubtaskBase):
    id: UUID
    status: str
    position: int
    order_index: int
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    title: str
    instructions: Optional[str] = None


class ProjectRead(BaseModel):
    id: UUID
    title: str
    raw_instructions: Optional[str]
    status: str
    created_at: datetime.datetime
    subtasks: List[SubtaskRead] = []

    model_config = {"from_attributes": True}
