from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    project_id: str
    uploaded_by: str  # user_id

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    filename: Optional[str] = None
    validation_status: Optional[str] = None
    validation_result: Optional[Dict[str, Any]] = None

class DocumentInDBBase(DocumentBase):
    id: str
    validation_status: str = "pending"  # pending, valid, invalid, error
    validation_result: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Document(DocumentInDBBase):
    pass

class DocumentValidation(BaseModel):
    status: str  # valid, invalid, error
    documento: Optional[Dict[str, Any]] = None
    assinaturas: Optional[List[Dict[str, Any]]] = None
    total_assinaturas: Optional[int] = None
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None