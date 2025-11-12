from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProjectBase(BaseModel):
    title: str
    description: str
    category: str
    skills_required: List[str] = []
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Dict[str, Any]
    attachments: List[str] = []
    deadline: Optional[datetime] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    skills_required: Optional[List[str]] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    final_budget: Optional[float] = None
    closed_by: Optional[str] = None

class ProjectInDBBase(ProjectBase):
    id: str
    client_id: str
    client_name: Optional[str] = None  # Added client name
    status: str
    created_at: datetime
    updated_at: datetime
    liberado_por: List[str] = []  # Array of professional IDs who liberated the project
    chat: List[Dict[str, Any]] = []  # Array of chats, each {professional_id, messages: []}
    closed_at: Optional[datetime] = None  # When project was closed
    final_budget: Optional[float] = None  # Final agreed budget
    closed_by: Optional[str] = None  # Professional ID who closed the project
    closed_by_name: Optional[str] = None  # Added professional name

    class Config:
        from_attributes = True

class Project(ProjectInDBBase):
    pass

class ProjectFilter(BaseModel):
    category: Optional[str] = None
    skills: Optional[List[str]] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None

class ProjectClose(BaseModel):
    final_budget: float = Field(..., gt=0)
    professional_id: str  # Professional closing the project

class EvaluationCreate(BaseModel):
    professional_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class Evaluation(BaseModel):
    id: str
    client_id: str
    professional_id: str
    project_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None