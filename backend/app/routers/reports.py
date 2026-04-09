"""Reports API Router - Placeholder implementation"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/api/reports", tags=["reports"])


# 内存存储的报告数据
_reports: Dict[str, Any] = {}


@router.get("")
async def list_reports():
    """获取报告列表"""
    return [
        {
            "runId": run_id,
            "status": data.get("status"),
            "totalTests": data.get("totalTests", 0),
            "passedTests": data.get("passedTests", 0),
            "failedTests": data.get("failedTests", 0),
            "createdAt": data.get("createdAt")
        }
        for run_id, data in _reports.items()
    ]


@router.get("/{run_id}/json")
async def get_report_json(run_id: str):
    """获取 JSON 格式报告"""
    if run_id not in _reports:
        raise HTTPException(status_code=404, detail="Report not found")
    return _reports[run_id].get("jsonData", {})


@router.get("/{run_id}/screenshots")
async def get_report_screenshots(run_id: str):
    """获取报告的截图列表"""
    if run_id not in _reports:
        raise HTTPException(status_code=404, detail="Report not found")
    return _reports[run_id].get("screenshots", [])


@router.get("/{run_id}/html")
async def get_report_html(run_id: str):
    """获取 HTML 格式报告"""
    if run_id not in _reports:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"html": _reports[run_id].get("html", "<html><body>No report</body></html>")}


@router.delete("")
async def delete_reports():
    """删除所有报告"""
    _reports.clear()
    return {"message": "All reports deleted"}


# 为测试执行提供存储函数
def save_report(run_id: str, data: Dict[str, Any]):
    """保存报告数据"""
    _reports[run_id] = {
        **data,
        "createdAt": datetime.utcnow().isoformat()
    }