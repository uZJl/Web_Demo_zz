"""Host API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.host import Host
from app.models.task import Task
from app.schemas.host import HostCreate, HostUpdate, HostResponse, HostWithTasks
from app.schemas.task import TaskResponse

router = APIRouter(prefix="/api/v1/hosts", tags=["hosts"])


@router.get("", response_model=List[HostResponse])
async def list_hosts(
    status: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """获取物理机列表"""
    query = select(Host)
    if status:
        query = query.where(Host.status == status)
    query = query.order_by(Host.last_active_at.desc().nullslast())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{ip}", response_model=HostWithTasks)
async def get_host(ip: str, db: AsyncSession = Depends(get_db)):
    """获取物理机详情（含任务列表）"""
    result = await db.execute(select(Host).where(Host.ip == ip))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    # 获取该主机关联的任务
    tasks_result = await db.execute(
        select(Task).where(Task.host_ip == ip).order_by(Task.started_at.desc())
    )
    tasks = tasks_result.scalars().all()

    return HostWithTasks(
        ip=host.ip,
        hostname=host.hostname,
        status=host.status,
        task_count=host.task_count,
        last_active_at=host.last_active_at,
        tags=host.tags or [],
        created_at=host.created_at,
        updated_at=host.updated_at,
        tasks=[TaskResponse(
            id=t.id,
            task_id=t.task_id,
            name=t.name,
            host_ip=t.host_ip,
            status=t.status,
            started_at=t.started_at,
            completed_at=t.completed_at,
            duration=t.duration,
            kafka_topic=t.kafka_topic,
            business_line=t.business_line,
            error=t.error,
            created_at=t.created_at,
            updated_at=t.updated_at
        ) for t in tasks]
    )


@router.post("", response_model=HostResponse, status_code=201)
async def create_host(host: HostCreate, db: AsyncSession = Depends(get_db)):
    """创建物理机"""
    # 检查是否已存在
    result = await db.execute(select(Host).where(Host.ip == host.ip))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Host already exists")

    db_host = Host(
        ip=host.ip,
        hostname=host.hostname,
        status=host.status,
        task_count=host.task_count,
        tags=host.tags
    )
    db.add(db_host)
    await db.commit()
    await db.refresh(db_host)
    return db_host


@router.put("/{ip}", response_model=HostResponse)
async def update_host(ip: str, host_update: HostUpdate, db: AsyncSession = Depends(get_db)):
    """更新物理机信息"""
    result = await db.execute(select(Host).where(Host.ip == ip))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    # 更新字段
    update_data = host_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(host, field, value)

    await db.commit()
    await db.refresh(host)
    return host


@router.delete("/{ip}", status_code=204)
async def delete_host(ip: str, db: AsyncSession = Depends(get_db)):
    """删除物理机"""
    result = await db.execute(select(Host).where(Host.ip == ip))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    await db.delete(host)
    await db.commit()
    return None


@router.get("/{ip}/tasks", response_model=List[TaskResponse])
async def get_host_tasks(ip: str, db: AsyncSession = Depends(get_db)):
    """获取物理机的任务列表"""
    result = await db.execute(
        select(Task).where(Task.host_ip == ip).order_by(Task.started_at.desc())
    )
    tasks = result.scalars().all()
    return tasks