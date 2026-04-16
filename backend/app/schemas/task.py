"""Task Pydantic Schemas"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TaskBase(BaseModel):
    task_id: Optional[str] = None
    name: str
    host_ip: Optional[str] = None
    status: str = "pending"
    kafka_topic_id: Optional[int] = None
    business_line_id: Optional[str] = None
    system_page: Optional[str] = None
    module: Optional[str] = None
    data_fields: Optional[List[str]] = []


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    host_ip: Optional[str] = None
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[int] = None
    kafka_topic_id: Optional[int] = None
    business_line_id: Optional[str] = None
    system_page: Optional[str] = None
    module: Optional[str] = None
    data_fields: Optional[List[str]] = None
    error: Optional[str] = None


class TaskResponse(TaskBase):
    id: int
    kafka_topic_name: Optional[str] = None
    business_line_name: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[int] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskWithHost(TaskResponse):
    host: Optional["HostResponse"] = None

    class Config:
        from_attributes = True


from app.schemas.host import HostResponse
TaskWithHost.model_rebuild()