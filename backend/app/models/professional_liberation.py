from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProfessionalLiberation(BaseModel):
    id: str = Field(alias="_id")
    professional_id: str
    project_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
    }