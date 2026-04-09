"""Kafka Topic 模型"""
from sqlalchemy import Column, String, Integer, JSON
from app.database import Base


class KafkaTopic(Base):
    __tablename__ = "kafka_topics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_name = Column(String(100), unique=True, nullable=False, index=True)
    producer_group = Column(String(100), nullable=True)
    consumer_group = Column(String(100), nullable=True)
    messages_per_sec = Column(Integer, default=0)
    lag = Column(Integer, default=0)
    business_lines = Column(JSON, default=list)