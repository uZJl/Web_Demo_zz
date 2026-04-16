"""业务线 BusinessLine 模型"""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class BusinessLine(Base):
    __tablename__ = "business_lines"

    id = Column(String(50), primary_key=True, default=lambda: f"bl-{uuid.uuid4().hex[:8]}")
    name = Column(String(100), unique=True, nullable=False)
    system_page = Column(String(200), nullable=True)
    module = Column(String(100), nullable=True)
    functions = Column(JSON, default=list)
    data_fields = Column(JSON, default=list)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, inactive
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())