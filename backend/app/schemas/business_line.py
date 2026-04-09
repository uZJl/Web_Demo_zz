"""BusinessLine Pydantic Schemas"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class BusinessLineBase(BaseModel):
    id: str
    name: str
    system_page: Optional[str] = None
    module: Optional[str] = None
    functions: List[str] = []
    data_fields: List[str] = []
    description: Optional[str] = None
    status: str = "active"


class BusinessLineCreate(BusinessLineBase):
    pass


class BusinessLineUpdate(BaseModel):
    name: Optional[str] = None
    system_page: Optional[str] = None
    module: Optional[str] = None
    functions: Optional[List[str]] = None
    data_fields: Optional[List[str]] = None
    description: Optional[str] = None
    status: Optional[str] = None


class BusinessLineResponse(BusinessLineBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True