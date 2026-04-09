#!/usr/bin/env python3
"""启动 FastAPI 后端服务"""
import uvicorn
import os
from pathlib import Path

# 设置工作目录为 backend
backend_dir = Path(__file__).parent
os.chdir(backend_dir)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 3001)),
        reload=True,
    )