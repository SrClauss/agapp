from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, List
from datetime import datetime, timezone
from ulid import new as new_ulid
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

async def get_document(db: AsyncIOMotorDatabase, document_id: str) -> Optional[Document]:
    document = await db.documents.find_one({"_id": document_id})
    return Document(**document) if document else None

async def get_documents_by_project(db: AsyncIOMotorDatabase, project_id: str) -> List[Document]:
    documents = []
    async for document in db.documents.find({"project_id": project_id}):
        try:
            documents.append(Document(**document))
        except Exception as e:
            # Log the error but continue processing other documents
            print(f"Error parsing document {document.get('_id', 'unknown')}: {e}")
            continue
    return documents

async def create_document(db: AsyncIOMotorDatabase, document: DocumentCreate) -> Document:
    document_dict = document.dict()
    document_dict["_id"] = str(new_ulid())
    document_dict["validation_status"] = "pending"
    document_dict["created_at"] = datetime.now(timezone.utc)
    document_dict["updated_at"] = datetime.now(timezone.utc)
    await db.documents.insert_one(document_dict)
    return Document(**document_dict)

async def update_document(db: AsyncIOMotorDatabase, document_id: str, document_update: DocumentUpdate) -> Optional[Document]:
    update_data = {k: v for k, v in document_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.documents.update_one({"_id": document_id}, {"$set": update_data})
    document = await get_document(db, document_id)
    return document

async def delete_document(db: AsyncIOMotorDatabase, document_id: str) -> bool:
    result = await db.documents.delete_one({"_id": document_id})
    return result.deleted_count > 0

async def get_documents_by_user(db: AsyncIOMotorDatabase, user_id: str) -> List[Document]:
    """Get all documents uploaded by a specific user"""
    documents = []
    async for document in db.documents.find({"uploaded_by": user_id}):
        documents.append(Document(**document))
    return documents