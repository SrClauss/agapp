#!/usr/bin/env python3
"""
Script para popular o banco de dados com ads de exemplo
Execute: python scripts/seed_ads.py
"""

import asyncio
import sys
from pathlib import Path
import os
import json

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# Tenta importar modelos do app; se não existir (scripts executados isolados), usar um fallback simples
try:
    from app.models.ad_content import AdContent, AdAssignment
except Exception:
    import uuid as _uuid_fallback
    from datetime import datetime as _dt_fallback

    class AdContent:
        def __init__(self, **kwargs):
            self._doc = kwargs
            self._doc.setdefault('id', str(_uuid_fallback.uuid4()))
            self._doc.setdefault('created_at', _dt_fallback.utcnow())
            self._doc.setdefault('updated_at', _dt_fallback.utcnow())
        def model_dump(self):
            return self._doc
        @property
        def id(self):
            return self._doc['id']
        def __getattr__(self, name):
            # Expor chaves do dict como atributos para compatibilidade com uso no script
            if name in self._doc:
                return self._doc[name]
            raise AttributeError(f"{self.__class__.__name__} object has no attribute {name}")

    class AdAssignment:
        def __init__(self, **kwargs):
            self._doc = kwargs
            self._doc.setdefault('created_at', _dt_fallback.utcnow())
        def model_dump(self):
            return self._doc
        def __getattr__(self, name):
            if name in self._doc:
                return self._doc[name]
            raise AttributeError(f"{self.__class__.__name__} object has no attribute {name}")

from ulid import ULID
from datetime import datetime

ADS_JSON_PATH = os.getenv('ADS_JSON_PATH')
ADS_SKIP_CLEAR = os.getenv('ADS_SKIP_CLEAR', '').lower() in ('1','true','yes','y')


async def seed_ads():
    # Connect to database
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    print("🔌 Conectado ao MongoDB")

    # Clear existing ads (unless skipped by ADS_SKIP_CLEAR)
    if not ADS_SKIP_CLEAR:
        await db.ad_contents.delete_many({})
        await db.ad_assignments.delete_many({})
        print("🗑️  Ads antigos removidos")
    else:
        print("⚠️  Pulando remoção de ads antigos (ADS_SKIP_CLEAR=true)")

    # Load ads from JSON file if provided
    if ADS_JSON_PATH:
        try:
            with open(ADS_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"🔁 Carregando ads de {ADS_JSON_PATH}")
            for ad in data.get('ad_contents', []):
                ad.setdefault('created_at', datetime.utcnow())
                ad.setdefault('updated_at', datetime.utcnow())
                await db.ad_contents.insert_one(ad)
                print(f"✅ Criado: {ad.get('alias')}")
            for assignment in data.get('ad_assignments', []):
                await db.ad_assignments.insert_one(assignment)
                print(f"🔗 Assignment criado: {assignment.get('location')} -> {assignment.get('ad_content_id')}")

            # Após inserir do JSON, criar índices, mostrar resumo e retornar
            await db.ad_contents.create_index("alias", unique=True)
            await db.ad_contents.create_index("type")
            await db.ad_contents.create_index("target")
            await db.ad_contents.create_index("is_active")
            await db.ad_contents.create_index([("priority", -1), ("created_at", -1)])
            await db.ad_assignments.create_index("location", unique=True)
            await db.ad_assignments.create_index("ad_content_id")
            print("📊 Índices criados")

            print("\n✨ Seed de ads concluído com sucesso (via JSON)!")
            print("\n📋 Resumo:")
            print(f"  - {await db.ad_contents.count_documents({})} ad contents criados")
            print(f"  - {await db.ad_assignments.count_documents({})} assignments criados")

            client.close()
            return
        except Exception as e:
            print(f"❌ Falha ao carregar ads de {ADS_JSON_PATH}: {e}")
            import traceback; traceback.print_exc()
            return

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
    # using Banner model instead of AdContent for new structure
    from app.models.banner import Banner
    banner_client = Banner(
        alias="banner_client_home",
        type="banner",
        target="client",
        is_active=True,
        priority=5,
        base64=None,
        onPress_type=None,
        onPress_link=None,
        onPress_stack=None,
        position=1
    )
    await db.ad_contents.insert_one(banner_client.model_dump())
    print(f"✅ Criado: {banner_client.alias} (ID: {banner_client.id})")

    # Create Banner Profissional
    from app.models.banner import Banner
    banner_professional = Banner(
        alias="banner_professional_home",
        type="banner",
        target="professional",
        is_active=True,
        priority=5,
        base64=None,
        onPress_type=None,
        onPress_link=None,
        onPress_stack=None,
        position=1
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
