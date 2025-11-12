from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Document(BaseModel):
    id: str = Field(alias="_id")
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    project_id: str
    uploaded_by: str
    validation_status: str = "pending"
    validation_result: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True