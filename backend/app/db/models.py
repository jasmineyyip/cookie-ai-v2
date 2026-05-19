import uuid
import datetime
from sqlalchemy import Column, String, Text, Enum, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


def utc_now():
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class Project(Base):
    __tablename__ = "projects"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    raw_instructions = Column(Text, nullable=True)
    status = Column(Enum('decomposing', 'ready', 'failed', name='project_status'), default='decomposing')
    created_at = Column(DateTime, default=utc_now)
    subtasks = relationship("Subtask", back_populates="project", cascade="all, delete-orphan")


class Subtask(Base):
    __tablename__ = "subtasks"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    estimated_minutes = Column(Integer, nullable=False, default=30)
    difficulty = Column(Enum('easy', 'medium', 'hard', name='subtask_difficulty'), nullable=False)
    status = Column(Enum('todo', 'in_progress', 'done', name='subtask_status'), default='todo')
    position = Column(Integer, nullable=False, default=0)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)
    project = relationship("Project", back_populates="subtasks")
