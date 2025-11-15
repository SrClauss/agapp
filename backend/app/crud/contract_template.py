from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
from ulid import new as new_ulid
import re

from app.models.contract_template import ContractTemplate
from app.schemas.contract_template import (
    ContractTemplateCreate,
    ContractTemplateUpdate,
    ContractTemplateImport
)


def extract_variables(template_text: str) -> List[str]:
    """
    Extract variable names from template text.
    Variables are in the format {{variable_name}}.
    """
    pattern = r'\{\{(\w+)\}\}'
    variables = re.findall(pattern, template_text)
    return list(set(variables))  # Remove duplicates


async def get_contract_template(
    db: AsyncIOMotorDatabase,
    template_id: str
) -> Optional[ContractTemplate]:
    """Get a contract template by ID"""
    template = await db.contract_templates.find_one({"_id": template_id})
    return ContractTemplate(**template) if template else None


async def get_contract_templates(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100
) -> List[ContractTemplate]:
    """Get all contract templates with pagination"""
    templates = []
    cursor = db.contract_templates.find().skip(skip).limit(limit)
    async for template in cursor:
        templates.append(ContractTemplate(**template))
    return templates


async def get_user_contract_templates(
    db: AsyncIOMotorDatabase,
    user_id: str,
    skip: int = 0,
    limit: int = 100
) -> List[ContractTemplate]:
    """Get all contract templates created by a specific user"""
    templates = []
    cursor = db.contract_templates.find(
        {"created_by": user_id}
    ).skip(skip).limit(limit)
    async for template in cursor:
        templates.append(ContractTemplate(**template))
    return templates


async def create_contract_template(
    db: AsyncIOMotorDatabase,
    template: ContractTemplateCreate,
    user_id: str
) -> ContractTemplate:
    """Create a new contract template"""
    # Extract variables from template text if not provided
    if not template.variables:
        variables = extract_variables(template.template_text)
    else:
        variables = template.variables

    template_dict = template.dict()
    template_dict["_id"] = str(new_ulid())
    template_dict["created_by"] = user_id
    template_dict["variables"] = variables
    template_dict["created_at"] = datetime.now(timezone.utc)
    template_dict["updated_at"] = datetime.now(timezone.utc)

    await db.contract_templates.insert_one(template_dict)
    return ContractTemplate(**template_dict)


async def import_contract_template(
    db: AsyncIOMotorDatabase,
    template_import: ContractTemplateImport,
    user_id: str
) -> ContractTemplate:
    """
    Import a contract template from text.
    Automatically extracts variables from the template text.
    """
    # Extract variables from the template text
    variables = extract_variables(template_import.template_text)

    template_dict = {
        "_id": str(new_ulid()),
        "title": template_import.title,
        "description": template_import.description,
        "template_text": template_import.template_text,
        "variables": variables,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    await db.contract_templates.insert_one(template_dict)
    return ContractTemplate(**template_dict)


async def update_contract_template(
    db: AsyncIOMotorDatabase,
    template_id: str,
    template_update: ContractTemplateUpdate
) -> Optional[ContractTemplate]:
    """Update an existing contract template"""
    update_data = {k: v for k, v in template_update.dict().items() if v is not None}

    if update_data:
        # If template_text is being updated, re-extract variables
        if "template_text" in update_data and "variables" not in update_data:
            update_data["variables"] = extract_variables(update_data["template_text"])

        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.contract_templates.update_one(
            {"_id": template_id},
            {"$set": update_data}
        )

    template = await get_contract_template(db, template_id)
    return template


async def delete_contract_template(
    db: AsyncIOMotorDatabase,
    template_id: str
) -> bool:
    """Delete a contract template"""
    result = await db.contract_templates.delete_one({"_id": template_id})
    return result.deleted_count > 0
