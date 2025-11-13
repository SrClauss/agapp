from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Any
import os
import shutil
from pathlib import Path
from datetime import datetime, timezone
from ulid import new as new_ulid

from app.core.database import get_database
from app.core.security import get_current_user
from app.crud.document import create_document, get_documents_by_project, get_document
from app.crud.project import get_project
from app.schemas.document import Document, DocumentCreate
from app.schemas.user import User
from app.utils.validator_api import validate_pdf

router = APIRouter()

DOCUMENTS_DIR = Path("documents")

@router.post("/upload/{project_id}", response_model=Document)
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Upload a document for a project and validate its signatures.
    Only project participants can upload documents.
    """
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is participant
    if str(current_user.id) != project.client_id and str(current_user.id) not in project.liberado_por:
        raise HTTPException(status_code=403, detail="Only project participants can upload documents")

    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Create documents directory if it doesn't exist
    DOCUMENTS_DIR.mkdir(exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{new_ulid()}{file_extension}"
    file_path = DOCUMENTS_DIR / unique_filename

    try:
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Validate signatures
        validation_result = validate_pdf(file_path, verbose=False)

        # Create document record
        document_data = DocumentCreate(
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=file_path.stat().st_size,
            mime_type=file.content_type or "application/pdf",
            project_id=project_id,
            uploaded_by=str(current_user.id)
        )

        document = await create_document(db, document_data)

        # Update document with validation result
        from app.crud.document import update_document
        from app.schemas.document import DocumentUpdate

        update_data = DocumentUpdate(
            validation_status=validation_result.get("status", "error"),
            validation_result=validation_result
        )

        updated_document = await update_document(db, document.id, update_data)

        return updated_document

    except Exception as e:
        # Clean up file if something went wrong
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@router.get("/project/{project_id}", response_model=List[Document])
async def get_project_documents(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Get all documents for a project.
    Only project participants can view documents.
    """
    # Check if project exists
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is participant
    if str(current_user.id) != project.client_id and str(current_user.id) not in project.liberado_por:
        raise HTTPException(status_code=403, detail="Only project participants can view documents")

    documents = await get_documents_by_project(db, project_id)
    return documents

@router.get("/{document_id}", response_model=Document)
async def get_document_info(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Get document information.
    Only project participants can view document info.
    """
    document = await get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if user is participant in the project
    project = await get_project(db, document.project_id)
    if str(current_user.id) != project.client_id and str(current_user.id) not in project.liberado_por:
        raise HTTPException(status_code=403, detail="Only project participants can view this document")

    return document

@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Download a document file.
    Only project participants can download documents.
    """
    document = await get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if user is participant in the project
    project = await get_project(db, document.project_id)
    if str(current_user.id) != project.client_id and str(current_user.id) not in project.liberado_por:
        raise HTTPException(status_code=403, detail="Only project participants can download this document")

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )