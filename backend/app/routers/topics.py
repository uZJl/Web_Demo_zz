"""Kafka Topic API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models.kafka_topic import KafkaTopic
from app.models.task import Task
from app.schemas.kafka_topic import KafkaTopicCreate, KafkaTopicUpdate, KafkaTopicResponse

router = APIRouter(prefix="/api/v1/topics", tags=["topics"])


@router.get("", response_model=List[KafkaTopicResponse])
async def list_topics(db: AsyncSession = Depends(get_db)):
    """获取 Kafka Topic 列表"""
    result = await db.execute(select(KafkaTopic).order_by(KafkaTopic.topic_name))
    return result.scalars().all()


@router.get("/{topic_name}", response_model=KafkaTopicResponse)
async def get_topic(topic_name: str, db: AsyncSession = Depends(get_db)):
    """获取 Topic 详情"""
    result = await db.execute(select(KafkaTopic).where(KafkaTopic.topic_name == topic_name))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.get("/{topic_name}/tasks", response_model=List[dict])
async def get_topic_tasks(topic_name: str, db: AsyncSession = Depends(get_db)):
    """获取 Topic 关联的任务"""
    # 先获取 topic 的 id
    topic_result = await db.execute(select(KafkaTopic).where(KafkaTopic.topic_name == topic_name))
    topic = topic_result.scalar_one_or_none()
    if not topic:
        return []

    result = await db.execute(
        select(Task).where(Task.kafka_topic_id == topic.id).order_by(Task.started_at.desc())
    )
    tasks = result.scalars().all()
    return [
        {
            "task_id": t.task_id,
            "name": t.name,
            "host_ip": t.host_ip,
            "status": t.status,
        }
        for t in tasks
    ]


@router.post("", response_model=KafkaTopicResponse, status_code=201)
async def create_topic(topic: KafkaTopicCreate, db: AsyncSession = Depends(get_db)):
    """创建 Kafka Topic"""
    db_topic = KafkaTopic(**topic.model_dump())
    db.add(db_topic)
    await db.commit()
    await db.refresh(db_topic)
    return db_topic


@router.put("/{topic_name}", response_model=KafkaTopicResponse)
async def update_topic(topic_name: str, topic_update: KafkaTopicUpdate, db: AsyncSession = Depends(get_db)):
    """更新 Topic"""
    result = await db.execute(select(KafkaTopic).where(KafkaTopic.topic_name == topic_name))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    update_data = topic_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_name}", status_code=204)
async def delete_topic(topic_name: str, db: AsyncSession = Depends(get_db)):
    """删除 Topic"""
    result = await db.execute(select(KafkaTopic).where(KafkaTopic.topic_name == topic_name))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # 检查是否有任务关联该 Topic
    tasks_result = await db.execute(
        select(Task).where(Task.kafka_topic_id == topic.id)
    )
    tasks = tasks_result.scalars().all()
    if tasks:
        raise HTTPException(
            status_code=400,
            detail=f"该 Topic 已被 {len(tasks)} 个任务关联，无法删除"
        )

    await db.delete(topic)
    await db.commit()
    return None