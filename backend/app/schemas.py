from typing import List, Literal, Optional, Dict
from pydantic import BaseModel, Field
from uuid import UUID
import datetime


class SubtaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_minutes: int
    difficulty: str


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=5)
    difficulty: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "done"]] = None
    position: Optional[int] = Field(default=None, ge=0)


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    raw_instructions: Optional[str] = None


class SubtaskRead(SubtaskBase):
    id: UUID
    status: str
    position: int
    order_index: int
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class SubtaskMergeRequest(BaseModel):
    subtask_ids: List[str]


class SubtaskReorderItem(BaseModel):
    id: str
    position: int


class ProjectCreate(BaseModel):
    title: str
    instructions: Optional[str] = None


class ProjectRead(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    raw_instructions: Optional[str]
    status: str
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    subtasks: List[SubtaskRead] = []

    model_config = {"from_attributes": True}
