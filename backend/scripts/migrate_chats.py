"""
Script de migração: Move chats de projects.chat[] para contacts.chat[]
Execute antes de fazer deploy das mudanças
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def migrate_chats():
    # Conectar ao banco
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://admin:password@localhost:27017/agiliza_database?authSource=admin")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.get_database(os.getenv("DATABASE_NAME", "agiliza_database"))

    print("🔄 Iniciando migração de chats...")

    migrated_count = 0
    error_count = 0

    # Buscar todos os projetos com chats
    projects_with_chat = await db.projects.find({
        "chat": {"$exists": True, "$ne": []}
    }).to_list(length=None)

    print(f"📊 Encontrados {len(projects_with_chat)} projetos com chat")

    for project in projects_with_chat:
        project_id = project["_id"]

        # Para cada chat no projeto
        for chat in project.get("chat", []):
            professional_id = chat.get("professional_id")
            messages = chat.get("messages", [])

            if not professional_id:
                print(f"⚠️  Chat sem professional_id no projeto {project_id}")
                continue

            # Encontrar contato correspondente
            contact = await db.contacts.find_one({
                "project_id": project_id,
                "professional_id": professional_id
            })

            if contact:
                # Migrar mensagens para o contato
                result = await db.contacts.update_one(
                    {"_id": contact["_id"]},
                    {"$set": {"chat": messages, "updated_at": datetime.utcnow()}}
                )

                if result.modified_count > 0:
                    migrated_count += 1
                    print(f"✅ Migrado chat: Contact {contact['_id']} ({len(messages)} mensagens)")
                else:
                    print(f"⚠️  Nenhuma mudança no contato {contact['_id']}")
            else:
                error_count += 1
                print(f"❌ Contato não encontrado para projeto {project_id}, profissional {professional_id}")

        # Remover campo chat do projeto
        await db.projects.update_one(
            {"_id": project_id},
            {"$unset": {"chat": ""}}
        )

    print("\n" + "="*60)
    print(f"✅ Migração concluída!")
    print(f"   - Chats migrados: {migrated_count}")
    print(f"   - Erros: {error_count}")
    print("="*60)

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_chats())
