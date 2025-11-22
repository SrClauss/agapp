from typing import Optional, List, Literal
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.ad_content import AdContent, AdAssignment
from app.schemas.ad_content import AdContentCreate, AdContentUpdate, AdAssignmentCreate
from ulid import ULID
import os
import base64
from pathlib import Path


class CRUDAdContent:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.ad_contents
        self.assignments_collection = db.ad_assignments
        self.ads_dir = Path("./ads")
        self.ads_dir.mkdir(exist_ok=True)

    async def create(self, ad_content: AdContentCreate) -> AdContent:
        """Create new ad content"""
        # Check if alias already exists
        existing = await self.collection.find_one({"alias": ad_content.alias})
        if existing:
            raise ValueError(f"Ad content with alias '{ad_content.alias}' already exists")

        # Create directory for this ad content
        ad_dir = self.ads_dir / ad_content.alias
        ad_dir.mkdir(exist_ok=True)

        new_ad = AdContent(
            **ad_content.model_dump(),
            index_html=f"{ad_content.alias}/index.html",
            css_files=[],
            js_files=[],
            image_files=[]
        )

        await self.collection.insert_one(new_ad.model_dump())
        return new_ad

    async def get_by_id(self, ad_id: str) -> Optional[AdContent]:
        """Get ad content by ID"""
        doc = await self.collection.find_one({"id": ad_id})
        return AdContent(**doc) if doc else None

    async def get_by_alias(self, alias: str) -> Optional[AdContent]:
        """Get ad content by alias"""
        doc = await self.collection.find_one({"alias": alias})
        return AdContent(**doc) if doc else None

    async def get_all(
        self,
        type: Optional[Literal["publi_screen", "banner"]] = None,
        target: Optional[Literal["client", "professional", "both"]] = None,
        is_active: Optional[bool] = None
    ) -> List[AdContent]:
        """Get all ad contents with optional filters"""
        query = {}
        if type:
            query["type"] = type
        if target:
            query["target"] = {"$in": [target, "both"]}
        if is_active is not None:
            query["is_active"] = is_active

        cursor = self.collection.find(query).sort("priority", -1)
        docs = await cursor.to_list(length=100)
        return [AdContent(**doc) for doc in docs]

    async def update(self, ad_id: str, ad_update: AdContentUpdate) -> Optional[AdContent]:
        """Update ad content"""
        update_data = {k: v for k, v in ad_update.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_by_id(ad_id)

        update_data["updated_at"] = datetime.now(datetime.timezone.utc)

        result = await self.collection.find_one_and_update(
            {"id": ad_id},
            {"$set": update_data},
            return_document=True
        )

        return AdContent(**result) if result else None

    async def delete(self, ad_id: str) -> bool:
        """Delete ad content"""
        # Get ad content first to delete files
        ad = await self.get_by_id(ad_id)
        if not ad:
            return False

        # Delete directory with all files
        ad_dir = self.ads_dir / ad.alias
        if ad_dir.exists():
            import shutil
            shutil.rmtree(ad_dir)

        # Delete from database
        result = await self.collection.delete_one({"id": ad_id})

        # Delete any assignments
        await self.assignments_collection.delete_many({"ad_content_id": ad_id})

        return result.deleted_count > 0

    async def increment_views(self, ad_id: str) -> bool:
        """Increment view count"""
        result = await self.collection.update_one(
            {"id": ad_id},
            {"$inc": {"views": 1}}
        )
        return result.modified_count > 0

    async def increment_clicks(self, ad_id: str) -> bool:
        """Increment click count"""
        result = await self.collection.update_one(
            {"id": ad_id},
            {"$inc": {"clicks": 1}}
        )
        return result.modified_count > 0

    async def add_file(
        self,
        ad_id: str,
        filename: str,
        content: bytes,
        file_type: Literal["css", "js", "image"]
    ) -> Optional[AdContent]:
        """Add a file to ad content"""
        ad = await self.get_by_id(ad_id)
        if not ad:
            return None

        # Save file to disk
        ad_dir = self.ads_dir / ad.alias
        ad_dir.mkdir(exist_ok=True)

        file_path = ad_dir / filename
        with open(file_path, "wb") as f:
            f.write(content)

        # Update database
        relative_path = f"{ad.alias}/{filename}"

        if file_type == "css":
            field = "css_files"
        elif file_type == "js":
            field = "js_files"
        else:  # image
            field = "image_files"

        result = await self.collection.find_one_and_update(
            {"id": ad_id},
            {
                "$addToSet": {field: relative_path},
                "$set": {"updated_at": datetime.now(datetime.timezone.utc)}
            },
            return_document=True
        )

        return AdContent(**result) if result else None

    async def remove_file(
        self,
        ad_id: str,
        filename: str,
        file_type: Literal["css", "js", "image"]
    ) -> Optional[AdContent]:
        """Remove a file from ad content"""
        ad = await self.get_by_id(ad_id)
        if not ad:
            return None

        # Delete file from disk
        file_path = self.ads_dir / ad.alias / filename
        if file_path.exists():
            file_path.unlink()

        # Update database
        relative_path = f"{ad.alias}/{filename}"

        if file_type == "css":
            field = "css_files"
        elif file_type == "js":
            field = "js_files"
        else:  # image
            field = "image_files"

        result = await self.collection.find_one_and_update(
            {"id": ad_id},
            {
                "$pull": {field: relative_path},
                "$set": {"updated_at": datetime.now(datetime.timezone.utc)}
            },
            return_document=True
        )

        return AdContent(**result) if result else None

    async def get_file_content(self, ad_id: str) -> Optional[dict]:
        """Get all file contents for an ad (for mobile app consumption)"""
        ad = await self.get_by_id(ad_id)
        if not ad:
            return None

        result = {
            "id": ad.id,
            "alias": ad.alias,
            "type": ad.type,
            "html": "",
            "css": "",
            "js": "",
            "images": {}
        }

        # Read HTML
        html_path = self.ads_dir / ad.index_html
        if html_path.exists():
            with open(html_path, "r", encoding="utf-8") as f:
                result["html"] = f.read()

        # Read and combine CSS
        css_contents = []
        for css_file in ad.css_files:
            css_path = self.ads_dir / css_file
            if css_path.exists():
                with open(css_path, "r", encoding="utf-8") as f:
                    css_contents.append(f.read())
        result["css"] = "\n".join(css_contents)

        # Read and combine JS
        js_contents = []
        for js_file in ad.js_files:
            js_path = self.ads_dir / js_file
            if js_path.exists():
                with open(js_path, "r", encoding="utf-8") as f:
                    js_contents.append(f.read())
        result["js"] = "\n".join(js_contents)

        # Read images and convert to base64
        for image_file in ad.image_files:
            image_path = self.ads_dir / image_file
            if image_path.exists():
                with open(image_path, "rb") as f:
                    image_data = base64.b64encode(f.read()).decode()
                    # Determine MIME type
                    ext = image_path.suffix.lower()
                    mime_types = {
                        ".png": "image/png",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".gif": "image/gif",
                        ".svg": "image/svg+xml",
                        ".webp": "image/webp"
                    }
                    mime = mime_types.get(ext, "image/png")
                    result["images"][image_file.split("/")[-1]] = f"data:{mime};base64,{image_data}"

        return result

    # Assignment methods
    async def create_assignment(self, assignment: AdAssignmentCreate) -> AdAssignment:
        """Create new ad assignment"""
        # Check if ad content exists
        ad = await self.get_by_id(assignment.ad_content_id)
        if not ad:
            raise ValueError(f"Ad content with id '{assignment.ad_content_id}' not found")

        # Remove existing assignment for this location
        await self.assignments_collection.delete_many({"location": assignment.location})

        new_assignment = AdAssignment(**assignment.model_dump())
        await self.assignments_collection.insert_one(new_assignment.model_dump())
        return new_assignment

    async def get_assignment(self, location: str) -> Optional[AdAssignment]:
        """Get ad assignment for a specific location"""
        doc = await self.assignments_collection.find_one({"location": location})
        return AdAssignment(**doc) if doc else None

    async def get_all_assignments(self) -> List[AdAssignment]:
        """Get all ad assignments"""
        cursor = self.assignments_collection.find({})
        docs = await cursor.to_list(length=100)
        return [AdAssignment(**doc) for doc in docs]

    async def delete_assignment(self, location: str) -> bool:
        """Delete ad assignment"""
        result = await self.assignments_collection.delete_many({"location": location})
        return result.deleted_count > 0

    async def get_active_ad_for_location(self, location: str) -> Optional[dict]:
        """Get active ad content with files for a specific location"""
        # Get assignment
        assignment = await self.get_assignment(location)
        if not assignment:
            return None

        # Get ad content
        ad = await self.get_by_id(assignment.ad_content_id)
        if not ad or not ad.is_active:
            return None

        # Check date range
        now = datetime.now(datetime.timezone.utc)
        if ad.start_date and now < ad.start_date:
            return None
        if ad.end_date and now > ad.end_date:
            return None

        # Get file content
        content = await self.get_file_content(ad.id)

        # Increment views
        await self.increment_views(ad.id)

        return content


def get_ad_content_crud(db: AsyncIOMotorDatabase) -> CRUDAdContent:
    return CRUDAdContent(db)
