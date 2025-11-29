#!/usr/bin/env python3
"""
Script para popular categorias de exemplo no banco de dados com tags para busca
"""
import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# Categorias de exemplo com tags ricas para busca
SAMPLE_CATEGORIES = [
    {
        "name": "Reparos Eletrônicos",
        "tags": ["reparo", "conserto", "eletrônica", "assistência técnica", "manutenção"],
        "subcategories": [
            {
                "name": "Conserto de Televisão",
                "tags": ["tv", "televisão", "televisor", "conserto", "reparo", "tela", "imagem", "som", "smart tv"]
            },
            {
                "name": "Conserto de Geladeira",
                "tags": ["geladeira", "refrigerador", "conserto", "reparo", "gás", "motor", "não gela", "barulho"]
            },
            {
                "name": "Conserto de Fogão",
                "tags": ["fogão", "conserto", "reparo", "boca", "forno", "gás", "acendimento", "queimador"]
            },
            {
                "name": "Conserto de Microondas",
                "tags": ["microondas", "conserto", "reparo", "não aquece", "prato giratório", "timer"]
            },
            {
                "name": "Conserto de Ar Condicionado",
                "tags": ["ar condicionado", "climatização", "conserto", "reparo", "gás", "limpeza", "manutenção", "split"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Programação",
        "tags": ["programação", "desenvolvimento", "software", "código", "sistema", "aplicativo", "tecnologia"],
        "subcategories": [
            {
                "name": "Desenvolvimento Web",
                "tags": ["web", "site", "website", "internet", "html", "css", "javascript", "react", "angular", "vue"]
            },
            {
                "name": "Desenvolvimento Mobile",
                "tags": ["app", "aplicativo", "celular", "android", "ios", "mobile", "react native", "flutter"]
            },
            {
                "name": "Backend",
                "tags": ["backend", "servidor", "api", "banco de dados", "python", "node", "java", "rest"]
            },
            {
                "name": "Frontend",
                "tags": ["frontend", "interface", "ui", "html", "css", "javascript", "react", "vue", "angular"]
            },
            {
                "name": "DevOps",
                "tags": ["devops", "deploy", "servidor", "cloud", "aws", "docker", "kubernetes", "ci/cd"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Serviços Jurídicos",
        "tags": ["advogado", "advocacia", "jurídico", "direito", "legal", "consultoria jurídica"],
        "subcategories": [
            {
                "name": "Direito Trabalhista",
                "tags": ["trabalhista", "trabalho", "clt", "rescisão", "demissão", "direitos trabalhistas", "processo trabalhista"]
            },
            {
                "name": "Direito Civil",
                "tags": ["civil", "contrato", "família", "divórcio", "herança", "inventário", "usucapião"]
            },
            {
                "name": "Direito Tributário",
                "tags": ["tributário", "imposto", "tributo", "fiscal", "ir", "icms", "iss", "inss"]
            },
            {
                "name": "Elaboração de Contratos",
                "tags": ["contrato", "acordo", "documento", "elaboração", "redação", "cláusulas"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Design e Criação",
        "tags": ["design", "criação", "arte", "visual", "gráfico", "criativo"],
        "subcategories": [
            {
                "name": "Design Gráfico",
                "tags": ["design gráfico", "flyer", "cartão de visita", "banner", "arte", "photoshop", "illustrator"]
            },
            {
                "name": "Logo e Identidade Visual",
                "tags": ["logo", "logotipo", "marca", "identidade visual", "branding", "criação de marca"]
            },
            {
                "name": "UI/UX Design",
                "tags": ["ui", "ux", "interface", "experiência do usuário", "prototipagem", "figma", "design de app"]
            },
            {
                "name": "Ilustração",
                "tags": ["ilustração", "desenho", "arte digital", "ilustrador", "cartoon", "personagem"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Marketing Digital",
        "tags": ["marketing", "digital", "publicidade", "propaganda", "divulgação", "online"],
        "subcategories": [
            {
                "name": "Gestão de Redes Sociais",
                "tags": ["redes sociais", "social media", "instagram", "facebook", "tiktok", "gestão", "conteúdo"]
            },
            {
                "name": "SEO",
                "tags": ["seo", "google", "otimização", "busca orgânica", "ranqueamento", "palavras-chave"]
            },
            {
                "name": "Google Ads",
                "tags": ["google ads", "anúncios", "ppc", "links patrocinados", "campanha", "publicidade paga"]
            },
            {
                "name": "Copywriting",
                "tags": ["copy", "copywriting", "redação", "texto persuasivo", "vendas", "conteúdo"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Construção e Reformas",
        "tags": ["construção", "reforma", "obra", "pedreiro", "mestre de obras", "acabamento"],
        "subcategories": [
            {
                "name": "Pintura",
                "tags": ["pintura", "pintor", "parede", "tinta", "acabamento", "decoração"]
            },
            {
                "name": "Elétrica Residencial",
                "tags": ["eletricista", "elétrica", "fiação", "tomada", "interruptor", "disjuntor", "chuveiro", "instalação elétrica"]
            },
            {
                "name": "Hidráulica",
                "tags": ["encanador", "hidráulica", "cano", "vazamento", "entupimento", "torneira", "registro", "água"]
            },
            {
                "name": "Gesso e Drywall",
                "tags": ["gesso", "drywall", "forro", "parede", "divisória", "sanca", "moldura"]
            },
            {
                "name": "Alvenaria",
                "tags": ["alvenaria", "pedreiro", "tijolo", "bloco", "parede", "muro", "construção"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Arquitetura e Engenharia",
        "tags": ["arquitetura", "engenharia", "projeto", "construção", "planta", "técnico"],
        "subcategories": [
            {
                "name": "Projeto Arquitetônico",
                "tags": ["projeto", "arquitetura", "planta", "design de interiores", "reforma", "casa", "apartamento"]
            },
            {
                "name": "Projeto Estrutural",
                "tags": ["estrutural", "engenharia", "cálculo estrutural", "fundação", "laje", "viga", "pilar"]
            },
            {
                "name": "Laudo Técnico",
                "tags": ["laudo", "técnico", "vistoria", "perícia", "inspeção", "avaliação"]
            },
            {
                "name": "Regularização de Imóveis",
                "tags": ["regularização", "documentação", "habite-se", "aprovação", "prefeitura", "escritura"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Contabilidade",
        "tags": ["contador", "contabilidade", "fiscal", "impostos", "declaração", "empresarial"],
        "subcategories": [
            {
                "name": "Declaração de IR",
                "tags": ["imposto de renda", "ir", "declaração", "irpf", "restituição", "receita federal"]
            },
            {
                "name": "Abertura de Empresa",
                "tags": ["abrir empresa", "cnpj", "mei", "ltda", "constituição", "registro"]
            },
            {
                "name": "Consultoria Fiscal",
                "tags": ["fiscal", "tributário", "impostos", "consultoria", "planejamento tributário"]
            },
            {
                "name": "Folha de Pagamento",
                "tags": ["folha", "pagamento", "holerite", "encargos", "inss", "fgts", "rh"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Beleza e Estética",
        "tags": ["beleza", "estética", "cuidados", "tratamento", "bem-estar"],
        "subcategories": [
            {
                "name": "Cabeleireiro",
                "tags": ["cabelo", "cabeleireiro", "corte", "tintura", "escova", "penteado", "salão"]
            },
            {
                "name": "Manicure e Pedicure",
                "tags": ["manicure", "pedicure", "unha", "esmaltação", "cutícula", "pé", "mão"]
            },
            {
                "name": "Depilação",
                "tags": ["depilação", "cera", "laser", "pelo", "estética", "corpo"]
            },
            {
                "name": "Estética Facial",
                "tags": ["estética facial", "limpeza de pele", "peeling", "facial", "tratamento", "rosto"]
            },
            {
                "name": "Maquiagem",
                "tags": ["maquiagem", "make", "maquiador", "evento", "noiva", "festa"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Saúde e Bem-estar",
        "tags": ["saúde", "bem-estar", "terapia", "tratamento", "cuidados"],
        "subcategories": [
            {
                "name": "Nutrição",
                "tags": ["nutricionista", "nutrição", "dieta", "emagrecimento", "alimentação", "cardápio"]
            },
            {
                "name": "Personal Training",
                "tags": ["personal", "personal trainer", "treino", "academia", "exercício", "musculação", "fitness"]
            },
            {
                "name": "Fisioterapia",
                "tags": ["fisioterapia", "fisioterapeuta", "reabilitação", "dor", "lesão", "tratamento"]
            },
            {
                "name": "Psicologia",
                "tags": ["psicólogo", "psicologia", "terapia", "consulta", "ansiedade", "depressão", "saúde mental"]
            },
            {
                "name": "Massagem",
                "tags": ["massagem", "massoterapia", "relaxamento", "terapêutica", "muscular", "dor"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Educação",
        "tags": ["educação", "ensino", "aulas", "professor", "aprendizado", "curso"],
        "subcategories": [
            {
                "name": "Aulas Particulares - Matemática",
                "tags": ["matemática", "aula particular", "reforço", "professor", "álgebra", "geometria", "cálculo"]
            },
            {
                "name": "Aulas de Inglês",
                "tags": ["inglês", "english", "idioma", "conversação", "professor", "aula particular"]
            },
            {
                "name": "Aulas de Música",
                "tags": ["música", "violão", "piano", "guitarra", "bateria", "canto", "professor de música"]
            },
            {
                "name": "Preparação para Vestibular",
                "tags": ["vestibular", "enem", "preparatório", "cursinho", "professor", "concurso"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Automotivo",
        "tags": ["automotivo", "carro", "veículo", "automóvel", "moto"],
        "subcategories": [
            {
                "name": "Mecânica Automotiva",
                "tags": ["mecânico", "mecânica", "carro", "motor", "conserto", "revisão", "oficina"]
            },
            {
                "name": "Elétrica Automotiva",
                "tags": ["elétrica automotiva", "eletricista de carro", "alarme", "som automotivo", "bateria"]
            },
            {
                "name": "Funilaria e Pintura",
                "tags": ["funilaria", "pintura automotiva", "lataria", "amassado", "arranhão", "polimento"]
            },
            {
                "name": "Lavagem e Estética Automotiva",
                "tags": ["lavagem", "estética automotiva", "polimento", "cristalização", "limpeza", "carro"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Limpeza",
        "tags": ["limpeza", "faxina", "higienização", "diarista", "limpador"],
        "subcategories": [
            {
                "name": "Diarista",
                "tags": ["diarista", "faxina", "limpeza", "casa", "apartamento", "doméstica"]
            },
            {
                "name": "Limpeza Pós-Obra",
                "tags": ["pós-obra", "limpeza pesada", "obra", "construção", "reforma"]
            },
            {
                "name": "Limpeza de Estofados",
                "tags": ["estofados", "sofá", "colchão", "tapete", "higienização", "impermeabilização"]
            },
            {
                "name": "Limpeza de Vidros",
                "tags": ["vidros", "janelas", "limpeza", "fachada", "altura"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Informática",
        "tags": ["informática", "computador", "pc", "notebook", "tecnologia", "ti"],
        "subcategories": [
            {
                "name": "Conserto de Computador",
                "tags": ["computador", "pc", "notebook", "conserto", "reparo", "manutenção", "técnico", "formatação"]
            },
            {
                "name": "Instalação de Software",
                "tags": ["software", "programa", "instalação", "windows", "office", "aplicativo"]
            },
            {
                "name": "Recuperação de Dados",
                "tags": ["recuperação", "dados", "hd", "pendrive", "backup", "arquivos perdidos"]
            },
            {
                "name": "Rede e Infraestrutura",
                "tags": ["rede", "internet", "wifi", "roteador", "cabeamento", "servidor"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Fotografia e Vídeo",
        "tags": ["fotografia", "foto", "vídeo", "filmagem", "audiovisual"],
        "subcategories": [
            {
                "name": "Fotografia de Eventos",
                "tags": ["fotógrafo", "fotografia", "evento", "festa", "casamento", "formatura", "aniversário"]
            },
            {
                "name": "Edição de Vídeo",
                "tags": ["edição", "vídeo", "editor", "montagem", "premiere", "after effects"]
            },
            {
                "name": "Filmagem",
                "tags": ["filmagem", "vídeo", "cinegrafista", "câmera", "produção audiovisual"]
            },
            {
                "name": "Fotografia de Produtos",
                "tags": ["fotografia de produtos", "e-commerce", "catálogo", "produtos", "estúdio"]
            }
        ],
        "default_remote_execution": False
    }
]

async def populate_categories():
    """Popula o banco com categorias de exemplo com tags ricas"""
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
        print(f"\n📝 Inserindo {len(SAMPLE_CATEGORIES)} categorias com tags ricas...")

        for category in SAMPLE_CATEGORIES:
            category_doc = {
                "name": category["name"],
                "tags": category["tags"],
                "subcategories": category["subcategories"],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "is_active": True,
                "default_remote_execution": category.get("default_remote_execution", False)
            }

            result = await db.categories.insert_one(category_doc)
            remote_status = "✓ Remoto" if category.get("default_remote_execution", False) else ""
            total_tags = len(category["tags"]) + sum(len(sub["tags"]) for sub in category["subcategories"])
            print(f"✅ {category['name']} - {len(category['subcategories'])} subcategorias, {total_tags} tags {remote_status}")

        # Create indexes
        print("\n📊 Criando índices...")
        await db.categories.create_index("name", unique=True)
        await db.categories.create_index("is_active")
        await db.categories.create_index("tags")
        print("✅ Índices criados!")

        # Show final statistics
        total = await db.categories.count_documents({})
        print(f"\n🎉 Finalizado! Total de categorias: {total}")

        # Exemplo de busca
        print("\n💡 Exemplo de uso da busca:")
        print("   - Buscar 'conserto televisão' retornará 'Conserto de Televisão' (2 matches)")
        print("   - E também 'Conserto de Fogão' (1 match - 'conserto')")
        print("   - Ordenados por relevância!")

    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n👋 Conexão fechada.")

if __name__ == "__main__":
    asyncio.run(populate_categories())
