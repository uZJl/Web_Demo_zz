"""物理机 Host 模型"""
from sqlalchemy import Column, String, Integer, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class Host(Base):
    __tablename__ = "hosts"

    ip = Column(String(50), primary_key=True)
    hostname = Column(String(100), nullable=True)
    status = Column(String(20), default="offline")  # online, offline, alert
    task_count = Column(Integer, default=0)
    last_active_at = Column(DateTime, nullable=True)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())