from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Any, Dict
from datetime import datetime, timezone

from app.core.database import get_database
from app.core.security import get_current_user
from app.crud.contract_template import (
    create_contract_template,
    import_contract_template,
    get_contract_template,
    get_contract_templates,
    get_user_contract_templates,
    update_contract_template,
    delete_contract_template,
    extract_variables
)
from app.schemas.contract_template import (
    ContractTemplate,
    ContractTemplateCreate,
    ContractTemplateImport,
    ContractTemplateUpdate,
    ContractGenerateRequest,
    GeneratedContract
)
from app.schemas.user import User

router = APIRouter()


@router.post("/import", response_model=ContractTemplate)
async def import_template(
    template_import: ContractTemplateImport,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Import a contract template from text.
    Automatically extracts variable placeholders like {{variable_name}}.
    """
    template = await import_contract_template(db, template_import, str(current_user.id))
    return template


@router.post("/", response_model=ContractTemplate)
async def create_template(
    template: ContractTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Create a new contract template manually.
    If variables are not specified, they will be extracted from the template text.
    """
    created_template = await create_contract_template(db, template, str(current_user.id))
    return created_template


@router.get("/", response_model=List[ContractTemplate])
async def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    my_templates: bool = Query(False, description="Only return templates created by current user"),
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    List contract templates.
    Use my_templates=true to only get templates created by the current user.
    """
    if my_templates:
        templates = await get_user_contract_templates(db, str(current_user.id), skip, limit)
    else:
        templates = await get_contract_templates(db, skip, limit)
    return templates


@router.get("/{template_id}", response_model=ContractTemplate)
async def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """Get a specific contract template by ID"""
    template = await get_contract_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=ContractTemplate)
async def update_template(
    template_id: str,
    template_update: ContractTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Update a contract template.
    Only the creator can update their templates.
    """
    # Check if template exists and user is the creator
    template = await get_contract_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.created_by != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Only the template creator can update it"
        )

    updated_template = await update_contract_template(db, template_id, template_update)
    return updated_template


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Delete a contract template.
    Only the creator can delete their templates.
    """
    # Check if template exists and user is the creator
    template = await get_contract_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.created_by != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Only the template creator can delete it"
        )

    deleted = await delete_contract_template(db, template_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete template")

    return {"message": "Template deleted successfully"}


@router.post("/generate", response_model=GeneratedContract)
async def generate_contract(
    request: ContractGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Generate a contract from a template by substituting variables.
    Variables should be provided in the format: {"variable_name": "value"}
    """
    # Get template
    template = await get_contract_template(db, request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Substitute variables in template text
    contract_text = template.template_text

    for var_name, var_value in request.variables.items():
        placeholder = f"{{{{{var_name}}}}}"
        contract_text = contract_text.replace(placeholder, str(var_value))

    # Check if any variables were not substituted
    remaining_variables = extract_variables(contract_text)
    if remaining_variables:
        raise HTTPException(
            status_code=400,
            detail=f"Missing values for variables: {', '.join(remaining_variables)}"
        )

    return GeneratedContract(
        template_id=template.id,
        template_title=template.title,
        contract_text=contract_text,
        variables_used=request.variables,
        generated_at=datetime.now(timezone.utc)
    )


@router.post("/generate-for-project/{project_id}", response_model=GeneratedContract)
async def generate_contract_for_project(
    project_id: str,
    template_id: str = Query(..., description="ID of the contract template to use"),
    professional_id: str = Query(..., description="ID of the professional for the contract"),
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Generate a contract for a specific project automatically.
    Fetches project and user data to populate variables.
    """
    from app.crud.project import get_project
    from app.crud.user import get_user

    # Get template
    template = await get_contract_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get project
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is authorized (client or the professional)
    if str(current_user.id) != project.client_id and str(current_user.id) != professional_id:
        raise HTTPException(
            status_code=403,
            detail="Only the client or professional can generate contracts for this project"
        )

    # Get client and professional data
    client = await get_user(db, project.client_id)
    professional = await get_user(db, professional_id)

    if not client or not professional:
        raise HTTPException(status_code=404, detail="Client or professional not found")

    # Build variables dictionary
    variables = {
        "client_name": client.name,
        "client_email": client.email,
        "professional_name": professional.name,
        "professional_email": professional.email,
        "project_title": project.title,
        "project_description": project.description,
        "project_address": project.location.address if project.location else "N/A",
        "budget_min": str(project.budget_min) if project.budget_min else "A combinar",
        "budget_max": str(project.budget_max) if project.budget_max else "A combinar",
        "category_main": project.category.main if project.category else "N/A",
        "category_sub": project.category.sub if project.category else "",
        "current_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
    }

    # Add skills if present
    if project.skills_required:
        variables["skills_required"] = ", ".join(project.skills_required)

    # Substitute variables in template text
    contract_text = template.template_text

    for var_name, var_value in variables.items():
        placeholder = f"{{{{{var_name}}}}}"
        contract_text = contract_text.replace(placeholder, str(var_value))

    # Note: Some variables might not be substituted if not in our auto-generated list
    # This is expected - users can add custom variables to templates

    return GeneratedContract(
        template_id=template.id,
        template_title=template.title,
        contract_text=contract_text,
        variables_used=variables,
        generated_at=datetime.now(timezone.utc)
    )
