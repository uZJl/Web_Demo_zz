"""任务 Task 模型"""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(50), unique=True, nullable=False, index=True, default=lambda: f"task-{uuid.uuid4().hex[:8]}")
    name = Column(String(200), nullable=False)
    host_ip = Column(String(50), ForeignKey("hosts.ip"), nullable=True)
    status = Column(String(20), default="pending")  # running, completed, failed, pending
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)  # 毫秒
    kafka_topic = Column(String(100), nullable=True)
    business_line = Column(String(100), nullable=True)
    # 业务详情字段
    system_page = Column(String(200), nullable=True)
    module = Column(String(100), nullable=True)
    data_fields = Column(JSON, default=list)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())