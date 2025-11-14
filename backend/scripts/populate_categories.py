#!/usr/bin/env python3
"""
Script para popular categorias de exemplo no banco de dados
"""
import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# Categorias de exemplo
SAMPLE_CATEGORIES = [
    {
        "name": "Programação",
        "subcategories": [
            "Desenvolvimento Web",
            "Desenvolvimento Mobile",
            "Backend",
            "Frontend",
            "Full Stack",
            "DevOps",
            "Data Science",
            "Machine Learning"
        ]
    },
    {
        "name": "Serviços Jurídicos",
        "subcategories": [
            "Análise Jurídica",
            "Elaboração de Contratos",
            "Consultoria Empresarial",
            "Direito Trabalhista",
            "Direito Civil",
            "Direito Tributário",
            "Propriedade Intelectual"
        ]
    },
    {
        "name": "Design",
        "subcategories": [
            "Design Gráfico",
            "UI/UX Design",
            "Design de Logo",
            "Identidade Visual",
            "Motion Graphics",
            "Ilustração",
            "Design de Produto"
        ]
    },
    {
        "name": "Marketing",
        "subcategories": [
            "Marketing Digital",
            "Gestão de Redes Sociais",
            "SEO",
            "Google Ads",
            "Facebook Ads",
            "Email Marketing",
            "Content Marketing",
            "Copywriting"
        ]
    },
    {
        "name": "Arquitetura e Engenharia",
        "subcategories": [
            "Projeto Arquitetônico",
            "Projeto Estrutural",
            "Projeto Elétrico",
            "Projeto Hidráulico",
            "Laudo Técnico",
            "Regularização de Imóveis",
            "Acompanhamento de Obras"
        ]
    },
    {
        "name": "Contabilidade",
        "subcategories": [
            "Contabilidade Empresarial",
            "Declaração de IR",
            "Consultoria Fiscal",
            "Folha de Pagamento",
            "Abertura de Empresa",
            "Planejamento Tributário"
        ]
    },
    {
        "name": "Tradução",
        "subcategories": [
            "Tradução Inglês-Português",
            "Tradução Espanhol-Português",
            "Tradução Técnica",
            "Tradução Juramentada",
            "Revisão de Textos",
            "Interpretação"
        ]
    },
    {
        "name": "Consultoria",
        "subcategories": [
            "Consultoria Empresarial",
            "Consultoria Financeira",
            "Consultoria em RH",
            "Consultoria em TI",
            "Consultoria em Marketing",
            "Coaching",
            "Mentoria"
        ]
    },
    {
        "name": "Saúde e Bem-estar",
        "subcategories": [
            "Nutrição",
            "Personal Training",
            "Fisioterapia",
            "Psicologia",
            "Terapias Alternativas",
            "Yoga",
            "Pilates"
        ]
    },
    {
        "name": "Educação",
        "subcategories": [
            "Aulas Particulares",
            "Reforço Escolar",
            "Preparação para Vestibular",
            "Cursos de Idiomas",
            "Cursos Técnicos",
            "Treinamentos Corporativos"
        ]
    }
]

async def populate_categories():
    """Popula o banco com categorias de exemplo"""
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    try:
        print("🔗 Conectando ao MongoDB...")
        await client.server_info()
        print("✅ Conexão estabelecida!")

        # Check if categories already exist
        existing_count = await db.categories.count_documents({})
        if existing_count > 0:
            print(f"⚠️  Já existem {existing_count} categorias no banco.")
            response = input("Deseja remover todas e recomeçar? (s/N): ")
            if response.lower() == 's':
                result = await db.categories.delete_many({})
                print(f"🗑️  {result.deleted_count} categorias removidas.")
            else:
                print("❌ Operação cancelada.")
                return

        # Insert sample categories
        print(f"\n📝 Inserindo {len(SAMPLE_CATEGORIES)} categorias de exemplo...")

        for category in SAMPLE_CATEGORIES:
            category_doc = {
                "name": category["name"],
                "subcategories": category["subcategories"],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "is_active": True
            }

            result = await db.categories.insert_one(category_doc)
            print(f"✅ {category['name']} - {len(category['subcategories'])} subcategorias")

        # Create indexes
        print("\n📊 Criando índices...")
        await db.categories.create_index("name", unique=True)
        await db.categories.create_index("is_active")
        print("✅ Índices criados!")

        # Show final statistics
        total = await db.categories.count_documents({})
        print(f"\n🎉 Finalizado! Total de categorias: {total}")

    except Exception as e:
        print(f"❌ Erro: {e}")
    finally:
        client.close()
        print("\n👋 Conexão fechada.")

if __name__ == "__main__":
    asyncio.run(populate_categories())
