"""Alert API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.alert import Alert
from app.models.task import Task
from app.models.host import Host
from app.schemas.alert import AlertCreate, AlertResponse, AlertImpact

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    host_ip: Optional[str] = None,
    level: Optional[str] = None,
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取告警列表"""
    query = select(Alert)
    if host_ip:
        query = query.where(Alert.host_ip == host_ip)
    if level:
        query = query.where(Alert.level == level)
    if resolved is not None:
        if resolved:
            query = query.where(Alert.resolved_at.isnot(None))
        else:
            query = query.where(Alert.resolved_at.is_(None))
    query = query.order_by(Alert.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """获取告警详情"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/{alert_id}/impact", response_model=AlertImpact)
async def get_alert_impact(alert_id: str, db: AsyncSession = Depends(get_db)):
    """获取告警影响分析"""
    # 获取告警
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # 获取关联的主机
    host_result = await db.execute(select(Host).where(Host.ip == alert.host_ip))
    host = host_result.scalar_one_or_none()

    # 获取该主机上的所有任务
    tasks_result = await db.execute(
        select(Task).where(Task.host_ip == alert.host_ip).order_by(Task.started_at.desc())
    )
    tasks = tasks_result.scalars().all()

    # 收集业务线和 Topic
    business_lines = set()
    kafka_topics = set()
    for task in tasks:
        if task.business_line:
            business_lines.add(task.business_line)
        if task.kafka_topic:
            kafka_topics.add(task.kafka_topic)

    return AlertImpact(
        alert=AlertResponse(
            id=alert.id,
            host_ip=alert.host_ip,
            type=alert.type,
            level=alert.level,
            message=alert.message,
            created_at=alert.created_at,
            resolved_at=alert.resolved_at
        ),
        host={"ip": host.ip, "hostname": host.hostname, "status": host.status,
              "task_count": host.task_count, "last_active_at": host.last_active_at,
              "tags": host.tags or [], "created_at": host.created_at,
              "updated_at": host.updated_at} if host else None,
        tasks=[{"id": t.id, "task_id": t.task_id, "name": t.name, "host_ip": t.host_ip,
                "status": t.status, "started_at": t.started_at, "completed_at": t.completed_at,
                "duration": t.duration, "kafka_topic": t.kafka_topic,
                "business_line": t.business_line, "error": t.error,
                "created_at": t.created_at, "updated_at": t.updated_at} for t in tasks],
        business_lines=list(business_lines),
        kafka_topics=list(kafka_topics)
    )


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """解决告警"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(alert)
    return alert