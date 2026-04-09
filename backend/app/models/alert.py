"""告警 Alert 模型"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(50), primary_key=True)
    host_ip = Column(String(50), ForeignKey("hosts.ip"), nullable=False)
    type = Column(String(50), default="custom")  # cpu, memory, disk, network, custom
    level = Column(String(20), default="warning")  # warning, critical
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)