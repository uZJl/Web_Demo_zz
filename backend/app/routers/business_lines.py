"""BusinessLine API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models.business_line import BusinessLine
from app.schemas.business_line import BusinessLineCreate, BusinessLineUpdate, BusinessLineResponse

router = APIRouter(prefix="/api/v1/business-lines", tags=["business-lines"])


@router.get("", response_model=List[BusinessLineResponse])
async def list_business_lines(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取业务线列表"""
    query = select(BusinessLine)
    if status:
        query = query.where(BusinessLine.status == status)
    query = query.order_by(BusinessLine.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{name}", response_model=BusinessLineResponse)
async def get_business_line(name: str, db: AsyncSession = Depends(get_db)):
    """获取业务线详情"""
    result = await db.execute(select(BusinessLine).where(BusinessLine.name == name))
    bl = result.scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Business line not found")
    return bl


@router.post("", response_model=BusinessLineResponse, status_code=201)
async def create_business_line(bl: BusinessLineCreate, db: AsyncSession = Depends(get_db)):
    """创建业务线"""
    # 检查是否已存在
    result = await db.execute(select(BusinessLine).where(BusinessLine.name == bl.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Business line already exists")

    db_bl = BusinessLine(**bl.model_dump())
    db.add(db_bl)
    await db.commit()
    await db.refresh(db_bl)
    return db_bl


@router.put("/{name}", response_model=BusinessLineResponse)
async def update_business_line(name: str, bl_update: BusinessLineUpdate, db: AsyncSession = Depends(get_db)):
    """更新业务线"""
    result = await db.execute(select(BusinessLine).where(BusinessLine.name == name))
    bl = result.scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Business line not found")

    update_data = bl_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bl, field, value)

    await db.commit()
    await db.refresh(bl)
    return bl


@router.delete("/{name}", status_code=204)
async def delete_business_line(name: str, db: AsyncSession = Depends(get_db)):
    """删除业务线"""
    result = await db.execute(select(BusinessLine).where(BusinessLine.name == name))
    bl = result.scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Business line not found")

    # 检查是否有任务关联该业务线
    from app.models.task import Task
    tasks_result = await db.execute(
        select(Task).where(Task.business_line_id == bl.id)
    )
    tasks = tasks_result.scalars().all()
    if tasks:
        raise HTTPException(
            status_code=400,
            detail=f"该业务线已被 {len(tasks)} 个任务关联，无法删除"
        )

    await db.delete(bl)
    await db.commit()
    return None