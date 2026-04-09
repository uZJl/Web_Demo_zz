"""Test Execution API Router"""
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1", tags=["test-run"])


class RunRequest(BaseModel):
    suitePath: str
    engine: Optional[str] = "playwright"
    workers: Optional[int] = 1
    autVersion: Optional[str] = "1.0.0"


class RunResponse(BaseModel):
    runId: str
    status: str


@router.post("/run", response_model=RunResponse)
async def run_tests(request: RunRequest):
    """启动测试执行"""
    if not request.suitePath:
        raise HTTPException(status_code=400, detail="suitePath is required")

    run_id = f"run-{int(datetime.utcnow().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"

    # 返回运行 ID，测试执行需要由外部进程触发
    return RunResponse(runId=run_id, status="running")