"""Task API Router"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.database import get_db
from app.models.task import Task
from app.models.host import Host
from app.models.business_line import BusinessLine
from app.models.kafka_topic import KafkaTopic
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskWithHost

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    host_ip: Optional[str] = Query(None),
    business_line_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """获取任务列表"""
    query = select(Task).options(
        selectinload(Task.business_line_obj),
        selectinload(Task.kafka_topic_obj)
    )
    if status:
        query = query.where(Task.status == status)
    if host_ip:
        query = query.where(Task.host_ip == host_ip)
    if business_line_id:
        query = query.where(Task.business_line_id == business_line_id)
    if search:
        query = query.where(
            or_(Task.name.ilike(f"%{search}%"), Task.task_id.ilike(f"%{search}%"))
        )
    query = query.order_by(Task.started_at.desc().nullslast())
    result = await db.execute(query)
    tasks = result.scalars().all()

    # 构建返回结果，包含关联的名称
    return [
        TaskResponse(
            id=task.id,
            task_id=task.task_id,
            name=task.name,
            host_ip=task.host_ip,
            status=task.status,
            kafka_topic_id=task.kafka_topic_id,
            kafka_topic_name=task.kafka_topic_obj.topic_name if task.kafka_topic_obj else None,
            business_line_id=task.business_line_id,
            business_line_name=task.business_line_obj.name if task.business_line_obj else None,
            system_page=task.system_page,
            module=task.module,
            data_fields=task.data_fields or [],
            started_at=task.started_at,
            completed_at=task.completed_at,
            duration=task.duration,
            error=task.error,
            created_at=task.created_at,
            updated_at=task.updated_at
        )
        for task in tasks
    ]


@router.get("/{task_id}", response_model=TaskWithHost)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """获取任务详情"""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.business_line_obj),
            selectinload(Task.kafka_topic_obj)
        )
        .where(Task.task_id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # 获取关联的主机信息
    host = None
    if task.host_ip:
        host_result = await db.execute(select(Host).where(Host.ip == task.host_ip))
        host = host_result.scalar_one_or_none()

    task_response = TaskResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        host_ip=task.host_ip,
        status=task.status,
        kafka_topic_id=task.kafka_topic_id,
        kafka_topic_name=task.kafka_topic_obj.topic_name if task.kafka_topic_obj else None,
        business_line_id=task.business_line_id,
        business_line_name=task.business_line_obj.name if task.business_line_obj else None,
        system_page=task.system_page,
        module=task.module,
        data_fields=task.data_fields or [],
        started_at=task.started_at,
        completed_at=task.completed_at,
        duration=task.duration,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

    if host:
        from app.schemas.host import HostResponse
        return TaskWithHost(
            **task_response.model_dump(),
            host=HostResponse(
                ip=host.ip,
                hostname=host.hostname,
                status=host.status,
                task_count=host.task_count,
                last_active_at=host.last_active_at,
                created_at=host.created_at,
                updated_at=host.updated_at
            )
        )
    return TaskWithHost(**task_response.model_dump(), host=None)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(task: TaskCreate, db: AsyncSession = Depends(get_db)):
    """创建任务"""
    db_task = Task(**task.model_dump())
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)

    # 返回时加载关联对象获取名称
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.business_line_obj),
            selectinload(Task.kafka_topic_obj)
        )
        .where(Task.id == db_task.id)
    )
    task = result.scalar_one()

    return TaskResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        host_ip=task.host_ip,
        status=task.status,
        kafka_topic_id=task.kafka_topic_id,
        kafka_topic_name=task.kafka_topic_obj.topic_name if task.kafka_topic_obj else None,
        business_line_id=task.business_line_id,
        business_line_name=task.business_line_obj.name if task.business_line_obj else None,
        system_page=task.system_page,
        module=task.module,
        data_fields=task.data_fields or [],
        started_at=task.started_at,
        completed_at=task.completed_at,
        duration=task.duration,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate, db: AsyncSession = Depends(get_db)):
    """更新任务"""
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)

    # 返回时加载关联对象获取名称
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.business_line_obj),
            selectinload(Task.kafka_topic_obj)
        )
        .where(Task.id == task.id)
    )
    task = result.scalar_one()

    return TaskResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        host_ip=task.host_ip,
        status=task.status,
        kafka_topic_id=task.kafka_topic_id,
        kafka_topic_name=task.kafka_topic_obj.topic_name if task.kafka_topic_obj else None,
        business_line_id=task.business_line_id,
        business_line_name=task.business_line_obj.name if task.business_line_obj else None,
        system_page=task.system_page,
        module=task.module,
        data_fields=task.data_fields or [],
        started_at=task.started_at,
        completed_at=task.completed_at,
        duration=task.duration,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """删除任务"""
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return None


@router.get("/host/{ip}/tasks", response_model=List[TaskResponse])
async def get_host_tasks(ip: str, db: AsyncSession = Depends(get_db)):
    """获取物理机的任务列表"""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.business_line_obj),
            selectinload(Task.kafka_topic_obj)
        )
        .where(Task.host_ip == ip)
        .order_by(Task.started_at.desc())
    )
    tasks = result.scalars().all()

    return [
        TaskResponse(
            id=task.id,
            task_id=task.task_id,
            name=task.name,
            host_ip=task.host_ip,
            status=task.status,
            kafka_topic_id=task.kafka_topic_id,
            kafka_topic_name=task.kafka_topic_obj.topic_name if task.kafka_topic_obj else None,
            business_line_id=task.business_line_id,
            business_line_name=task.business_line_obj.name if task.business_line_obj else None,
            system_page=task.system_page,
            module=task.module,
            data_fields=task.data_fields or [],
            started_at=task.started_at,
            completed_at=task.completed_at,
            duration=task.duration,
            error=task.error,
            created_at=task.created_at,
            updated_at=task.updated_at
        )
        for task in tasks
    ]