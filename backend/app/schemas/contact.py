from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class ContactBase(BaseModel):
    contact_type: str = "proposal"
    contact_details: Dict[str, Any]

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    status: Optional[str] = None
    contact_details: Optional[Dict[str, Any]] = None

class ContactInDBBase(ContactBase):
    id: str
    professional_id: str
    professional_name: Optional[str] = None  # Added professional name
    project_id: str
    client_id: str
    client_name: Optional[str] = None  # Added client name
    credits_used: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Contact(ContactInDBBase):
    pass