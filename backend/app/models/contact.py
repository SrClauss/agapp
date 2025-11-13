from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class Contact(BaseModel):
    id: str = Field(alias="_id")
    professional_id: str
    professional_name: Optional[str] = None
    project_id: str
    client_id: str
    client_name: Optional[str] = None
    contact_type: str = "proposal"  # proposal, inquiry
    credits_used: int = 1
    status: str = "pending"  # pending, accepted, rejected, completed
    contact_details: Dict[str, Any]  # {message, proposal_price, etc.}
    chat: List[Dict[str, Any]] = []  # Chat messages: [{id, sender_id, content, created_at}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True