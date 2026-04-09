"""数据库配置"""
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, Session
import os
from pathlib import Path

# 数据库路径
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/testergizer.db")

# 异步引擎
engine = create_async_engine(DATABASE_URL, echo=False)

# 异步会话工厂
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 基础模型类
Base = declarative_base()


async def get_db() -> AsyncSession:
    """获取数据库会话的依赖函数"""
    async with async_session_maker() as session:
        yield session


async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_sync() -> Session:
    """同步获取数据库会话（用于启动时初始化数据）"""
    sync_url = DATABASE_URL.replace("+aiosqlite", "")
    sync_engine = create_engine(sync_url, connect_args={"check_same_thread": False})
    with Session(sync_engine) as session:
        yield session


def create_tables():
    """同步创建所有表（用于初始化）"""
    from app.models.host import Host
    from app.models.task import Task
    from app.models.alert import Alert
    from app.models.business_line import BusinessLine
    from app.models.kafka_topic import KafkaTopic

    sync_url = DATABASE_URL.replace("+aiosqlite", "")
    sync_engine = create_engine(sync_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(sync_engine)