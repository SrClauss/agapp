#!/usr/bin/env python3
"""
Script para popular o banco de dados com ads de exemplo
Execute: python scripts/seed_ads.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.models.ad_content import AdContent, AdAssignment
from ulid import ULID
from datetime import datetime


async def seed_ads():
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    print("🔌 Conectado ao MongoDB")

    # Clear existing ads
    await db.ad_contents.delete_many({})
    await db.ad_assignments.delete_many({})
    print("🗑️  Ads antigos removidos")

    # Create PubliScreen Cliente
    publi_client = AdContent(
        alias="publi_client_welcome",
        type="publi_screen",
        target="client",
        index_html="publi_client_welcome/index.html",
        css_files=["publi_client_welcome/style.css"],
        js_files=["publi_client_welcome/script.js"],
        image_files=["publi_client_welcome/logo.png"],
        title="Welcome Screen Cliente",
        description="Tela de boas-vindas exibida para clientes após login",
        is_active=True,
        priority=10
    )
    await db.ad_contents.insert_one(publi_client.model_dump())
    print(f"✅ Criado: {publi_client.alias} (ID: {publi_client.id})")

    # Create PubliScreen Profissional
    publi_professional = AdContent(
        alias="publi_professional_welcome",
        type="publi_screen",
        target="professional",
        index_html="publi_professional_welcome/index.html",
        css_files=["publi_professional_welcome/style.css"],
        js_files=["publi_professional_welcome/script.js"],
        image_files=["publi_professional_welcome/logo.png"],
        title="Welcome Screen Profissional",
        description="Tela de boas-vindas exibida para profissionais após login",
        is_active=True,
        priority=10
    )
    await db.ad_contents.insert_one(publi_professional.model_dump())
    print(f"✅ Criado: {publi_professional.alias} (ID: {publi_professional.id})")

    # Create Banner Cliente
    banner_client = AdContent(
        alias="banner_client_home",
        type="banner",
        target="client",
        index_html="banner_client_home/index.html",
        css_files=["banner_client_home/style.css"],
        js_files=["banner_client_home/script.js"],
        image_files=[],
        title="Banner Home Cliente",
        description="Banner exibido no topo da tela principal do cliente",
        is_active=True,
        priority=5
    )
    await db.ad_contents.insert_one(banner_client.model_dump())
    print(f"✅ Criado: {banner_client.alias} (ID: {banner_client.id})")

    # Create Banner Profissional
    banner_professional = AdContent(
        alias="banner_professional_home",
        type="banner",
        target="professional",
        index_html="banner_professional_home/index.html",
        css_files=["banner_professional_home/style.css"],
        js_files=["banner_professional_home/script.js"],
        image_files=[],
        title="Banner Home Profissional",
        description="Banner exibido no topo da tela principal do profissional",
        is_active=True,
        priority=5
    )
    await db.ad_contents.insert_one(banner_professional.model_dump())
    print(f"✅ Criado: {banner_professional.alias} (ID: {banner_professional.id})")

    # Create Assignments
    assignments = [
        AdAssignment(
            location="publi_screen_client",
            ad_content_id=publi_client.id
        ),
        AdAssignment(
            location="publi_screen_professional",
            ad_content_id=publi_professional.id
        ),
        AdAssignment(
            location="banner_client_home",
            ad_content_id=banner_client.id
        ),
        AdAssignment(
            location="banner_professional_home",
            ad_content_id=banner_professional.id
        )
    ]

    for assignment in assignments:
        await db.ad_assignments.insert_one(assignment.model_dump())
        print(f"🔗 Assignment criado: {assignment.location} -> {assignment.ad_content_id}")

    # Create indexes
    await db.ad_contents.create_index("alias", unique=True)
    await db.ad_contents.create_index("type")
    await db.ad_contents.create_index("target")
    await db.ad_contents.create_index("is_active")
    await db.ad_contents.create_index([("priority", -1), ("created_at", -1)])
    await db.ad_assignments.create_index("location", unique=True)
    await db.ad_assignments.create_index("ad_content_id")
    print("📊 Índices criados")

    print("\n✨ Seed de ads concluído com sucesso!")
    print("\n📋 Resumo:")
    print(f"  - {await db.ad_contents.count_documents({})} ad contents criados")
    print(f"  - {await db.ad_assignments.count_documents({})} assignments criados")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_ads())
