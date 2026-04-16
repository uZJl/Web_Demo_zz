"""Host Pydantic Schemas"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class HostBase(BaseModel):
    ip: str
    hostname: Optional[str] = None
    status: str = "offline"
    task_count: int = 0


class HostCreate(HostBase):
    pass


class HostUpdate(BaseModel):
    hostname: Optional[str] = None
    status: Optional[str] = None
    task_count: Optional[int] = None
    last_active_at: Optional[datetime] = None


class HostResponse(HostBase):
    ip: str
    last_active_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HostWithTasks(HostResponse):
    tasks: List["TaskResponse"] = []


# Import TaskResponse for forward reference
from app.schemas.task import TaskResponse
HostWithTasks.model_rebuild()