from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class ProjectBase(BaseModel):
    title: str
    description: str
    category: Union[str, Dict[str, str]]  # Aceita string (legacy) ou dict {main, sub}
    skills_required: List[str] = []
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Dict[str, Any]
    attachments: List[str] = []
    deadline: Optional[datetime] = None
    remote_execution: bool = False  # Permite execução remota do projeto

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[Union[str, Dict[str, str]]] = None  # Aceita string ou dict
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
    remote_execution: Optional[bool] = None

class ProjectInDBBase(ProjectBase):
    id: str = Field(alias="_id")
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
    liberado_por_profiles: List[Dict[str, Any]] = []  # Profiles for professionals who liberated the project

    class Config:
        from_attributes = True
        populate_by_name = True

class Project(ProjectInDBBase):
    pass

# Include liberated professionals profiles in responses
ProjectInDBBase.liberado_por_profiles = []

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