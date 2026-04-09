"""KafkaTopic Pydantic Schemas"""
from pydantic import BaseModel
from typing import List


class KafkaTopicBase(BaseModel):
    topic_name: str
    producer_group: str | None = None
    consumer_group: str | None = None
    messages_per_sec: int = 0
    lag: int = 0
    business_lines: List[str] = []


class KafkaTopicCreate(KafkaTopicBase):
    pass


class KafkaTopicUpdate(BaseModel):
    producer_group: str | None = None
    consumer_group: str | None = None
    messages_per_sec: int | None = None
    lag: int | None = None
    business_lines: List[str] | None = None


class KafkaTopicResponse(KafkaTopicBase):
    id: int

    class Config:
        from_attributes = True