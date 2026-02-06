from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProjectCategory(BaseModel):
    """Categoria do projeto com categoria principal e subcategoria"""
    main: str  # Categoria principal (ex: "Programação")
    sub: str   # Subcategoria (ex: "Desenvolvimento Web")

class Contact(BaseModel):
    """Contato aninhado dentro de um projeto"""
    professional_id: str
    professional_name: Optional[str] = None
    professional_user: Optional[Dict[str, Any]] = None  # User completo do profissional
    client_id: str
    client_name: Optional[str] = None
    contact_type: str = "proposal"  # proposal, inquiry
    credits_used: int = 1
    status: str = "pending"  # pending, accepted, rejected, completed
    contact_details: Dict[str, Any]  # {message, proposal_price, etc.}
    chats: List[Dict[str, Any]] = []  # Chat messages: [{sender_id, message, timestamp}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Project(BaseModel):
    id: str = Field(alias="_id")
    client_id: str
    client_name: Optional[str] = None
    professional_id: Optional[str] = None
    professional_name: Optional[str] = None
    # Limit title to 80 chars to match mobile card UI
    title: str = Field(..., max_length=80)
    description: str
    category: Dict[str, str]  # {"main": "Programação", "sub": "Desenvolvimento Web"}
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
    # Execução Remota
    remote_execution: bool = False  # Permite execução remota do projeto
    contacts: List[Contact] = []  # Lista de contatos aninhados

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }