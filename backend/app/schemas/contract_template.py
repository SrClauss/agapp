from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ContractTemplateBase(BaseModel):
    title: str
    description: Optional[str] = None
    template_text: str
    variables: List[str] = []


class ContractTemplateCreate(ContractTemplateBase):
    """Schema for creating a new contract template"""
    pass


class ContractTemplateUpdate(BaseModel):
    """Schema for updating an existing contract template"""
    title: Optional[str] = None
    description: Optional[str] = None
    template_text: Optional[str] = None
    variables: Optional[List[str]] = None


class ContractTemplateImport(BaseModel):
    """Schema for importing a contract template from text"""
    title: str
    description: Optional[str] = None
    template_text: str


class ContractTemplateInDBBase(ContractTemplateBase):
    id: str = Field(alias="_id")
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        from_attributes = True


class ContractTemplate(ContractTemplateInDBBase):
    """Complete contract template schema"""
    pass


class ContractGenerateRequest(BaseModel):
    """Schema for generating a contract from a template"""
    template_id: str
    variables: Dict[str, Any]  # Variable values to substitute in the template


class GeneratedContract(BaseModel):
    """Schema for a generated contract"""
    template_id: str
    template_title: str
    contract_text: str
    variables_used: Dict[str, Any]
    generated_at: datetime
