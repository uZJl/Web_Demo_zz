"""FastAPI 主应用"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.database import create_tables
from app.utils.init_data import init_sample_data

# 创建 FastAPI 应用
app = FastAPI(
    title="Testergizer API",
    description="Testergizer Open Core Backend API",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 注册路由
from app.routers import hosts, tasks, alerts, topics, business_lines, reports, recordings, test_run

app.include_router(hosts.router)
app.include_router(tasks.router)
app.include_router(alerts.router)
app.include_router(topics.router)
app.include_router(business_lines.router)
app.include_router(reports.router)
app.include_router(recordings.router)
app.include_router(test_run.router)


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    # 创建数据库表
    create_tables()

    # 初始化示例数据
    database_url = os.getenv("DATABASE_URL", "sqlite:///./testergizer.db")
    init_sample_data(database_url)


@app.get("/")
async def root():
    """健康检查"""
    return {"status": "ok", "service": "testergizer-api"}


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


# 导出 app 以便 uvicorn 使用
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)