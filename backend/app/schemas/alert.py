"""Alert Pydantic Schemas"""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class AlertBase(BaseModel):
    id: str
    host_ip: str
    type: str = "custom"
    level: str = "warning"
    message: str


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertImpact(BaseModel):
    """告警影响分析"""
    alert: AlertResponse
    host: Optional[dict[str, Any]] = None
    tasks: List[dict[str, Any]]
    business_lines: List[str]
    kafka_topics: List[str]

    class Config:
        from_attributes = True