from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Project(BaseModel):
    id: str = Field(alias="_id")
    client_id: str
    client_name: Optional[str] = None
    professional_id: Optional[str] = None
    professional_name: Optional[str] = None
    title: str
    description: str
    category: str
    skills_required: List[str] = []
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Dict[str, Any]  # {address: str, coordinates: [lng, lat]}
    attachments: List[str] = []  # URLs ou paths
    status: str = "open"  # open, in_progress, completed, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deadline: Optional[datetime] = None
    liberado_por: List[str] = []
    closed_at: Optional[datetime] = None
    final_budget: Optional[float] = None
    closed_by: Optional[str] = None
    closed_by_name: Optional[str] = None
    # Projeto Destacado
    is_featured: bool = False
    featured_until: Optional[datetime] = None
    featured_price: Optional[float] = None
    featured_purchased_at: Optional[datetime] = None
    featured_payment_id: Optional[str] = None  # ID do pagamento Asaas
    chat: List[Dict[str, Any]] = []  # Array of chats, each {professional_id, messages: []}

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True