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
        "name": "Assistência Técnica e Reparos",
        "tags": ["reparo", "conserto", "assistência técnica", "manutenção", "técnico", "arrumar", "reparar", "consertar", "defeito", "problema", "não funciona", "quebrado", "orçamento", "visita técnica", "eletrodoméstico", "eletrônicos", "maquinário", "suporte técnico"],
        "subcategories": [
            {
                "name": "Eletrodomésticos",
                "tags": ["geladeira", "refrigerador", "fogão", "cooktop", "forno elétrico", "microondas", "máquina de lavar", "lava e seca", "lava-louças", "ar condicionado", "split", "climatização", "não gela", "não liga", "vazamento", "barulho estranho", "consertar eletrodoméstico"]
            },
            {
                "name": "Eletrônicos",
                "tags": ["tv", "televisão", "smart tv", "notebook", "computador", "celular", "smartphone", "tablet", "videogame", "console", "câmera", "som", "home theater", "tela quebrada", "bateria", "formatação", "upgrade", "reparo de placa", "conserto de celular"]
            },
            {
                "name": "Informática",
                "tags": ["computador", "pc", "notebook", "impressora", "servidor", "rede", "wi-fi", "roteador", "cabeamento", "manutenção de computador", "suporte de ti", "remoção de vírus", "recuperação de dados", "formatação", "instalação de software"]
            },
            {
                "name": "Ar Condicionado e Climatização",
                "tags": ["ar condicionado", "ar-condicionado", "split", "inverter", "climatização", "instalação", "desinstalação", "limpeza", "higienização", "manutenção preventiva", "carga de gás", "não gela", "pingando", "conserto de ar condicionado"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Desenvolvimento e TI",
        "tags": ["programação", "desenvolvimento", "software", "código", "sistema", "aplicativo", "tecnologia", "programador", "desenvolvedor", "engenharia de software", "codificar", "script", "automação", "freelancer", "consultoria de ti", "ti", "dados", "análise"],
        "subcategories": [
            {
                "name": "Web e Mobile",
                "tags": ["site", "website", "loja virtual", "e-commerce", "aplicativo", "app", "android", "ios", "front-end", "back-end", "fullstack", "react", "react native", "flutter", "vue", "angular", "nodejs", "next.js", "php", "wordpress", "desenvolvedor de app"]
            },
            {
                "name": "Sistemas e Backend",
                "tags": ["backend", "servidor", "api", "banco de dados", "python", "java", "ruby", "c#", ".net", "microsserviços", "rest", "graphql", "sql", "mongodb", "postgresql", "arquitetura de software", "performance", "escalabilidade"]
            },
            {
                "name": "DevOps e Cloud",
                "tags": ["devops", "cloud", "aws", "azure", "google cloud", "docker", "kubernetes", "ci/cd", "infraestrutura como código", "automação de deploy", "monitoramento", "jenkins", "terraform", "ansible"]
            },
            {
                "name": "Análise de Dados e BI",
                "tags": ["dados", "análise de dados", "business intelligence", "bi", "data science", "ciência de dados", "machine learning", "ia", "inteligência artificial", "python", "r", "sql", "power bi", "tableau", "dashboards", "etl"]
            },
            {
                "name": "Segurança da Informação",
                "tags": ["segurança", "cibersegurança", "pentest", "análise de vulnerabilidades", "lgpd", "consultoria de segurança", "hacker ético", "firewall", "proteção de dados", "segurança de redes"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Construção e Reforma",
        "tags": ["construção", "reforma", "obra", "pedreiro", "mestre de obras", "acabamento", "empreiteiro", "serviços gerais", "marido de aluguel", "engenharia civil", "arquitetura", "leroy merlin", "telhanorte"],
        "subcategories": [
            {
                "name": "Alvenaria e Estrutura",
                "tags": ["pedreiro", "alvenaria", "parede", "muro", "reboco", "contrapiso", "fundação", "laje", "concreto", "assentamento de tijolo", "construir casa", "pequenas reformas"]
            },
            {
                "name": "Elétrica",
                "tags": ["eletricista", "instalação elétrica", "fiação", "tomada", "interruptor", "disjuntor", "chuveiro", "curto-circuito", "quadro de luz", "luminária", "ventilador de teto", "padrão de entrada"]
            },
            {
                "name": "Hidráulica",
                "tags": ["encanador", "bombeiro hidráulico", "vazamento", "infiltração", "entupimento", "caça vazamento", "desentupidora", "instalação de cano", "torneira", "vaso sanitário", "caixa d'água", "água quente e fria"]
            },
            {
                "name": "Pintura e Acabamentos",
                "tags": ["pintor", "pintura", "parede", "tinta", "massa corrida", "textura", "grafiato", "pintura externa", "pintura interna", "acabamento fino", "verniz", "lixamento"]
            },
            {
                "name": "Gesso e Drywall",
                "tags": ["gesseiro", "gesso", "drywall", "forro", "sanca", "rebaixamento de teto", "parede 3d", "moldura", "divisória de gesso", "acabamento em gesso"]
            },
            {
                "name": "Pisos e Revestimentos",
                "tags": ["azulejista", "colocação de piso", "porcelanato", "cerâmica", "piso vinílico", "laminado", "revestimento", "pastilha", "rejunte", "rodapé", "assentador de piso"]
            },
            {
                "name": "Marcenaria e Móveis",
                "tags": ["marceneiro", "marcenaria", "móveis planejados", "armário", "cozinha planejada", "guarda-roupa", "montagem de móveis", "reparo de móveis", "madeira", "mdf", "montador"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Design e Mídia",
        "tags": ["design", "criação", "arte", "visual", "gráfico", "criativo", "designer", "identidade visual", "comunicação visual", "mídia", "conteúdo", "produção"],
        "subcategories": [
            {
                "name": "Design Gráfico e Branding",
                "tags": ["design gráfico", "logo", "logotipo", "identidade visual", "branding", "manual da marca", "criação de marca", "flyer", "cartão de visita", "folder", "banner", "photoshop", "illustrator", "canva", "diagramação"]
            },
            {
                "name": "UI/UX Design",
                "tags": ["ui/ux", "ui design", "ux design", "interface", "experiência do usuário", "design de aplicativo", "design de site", "protótipo", "wireframe", "figma", "adobe xd", "sketch", "jornada do usuário"]
            },
            {
                "name": "Fotografia e Vídeo",
                "tags": ["fotógrafo", "videomaker", "ensaio fotográfico", "foto de produto", "vídeo institucional", "filmagem de evento", "casamento", "aniversário", "drone", "edição de vídeo", "premiere", "final cut", "tratamento de imagem", "lightroom"]
            },
            {
                "name": "Ilustração e Animação",
                "tags": ["ilustrador", "desenhista", "arte digital", "personagem", "mascote", "animação 2d", "motion graphics", "after effects", "procreate", "desenho vetorial", "infográfico animado"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Marketing e Vendas",
        "tags": ["marketing digital", "publicidade", "propaganda", "vendas", "divulgação", "online", "crescimento", "estratégia digital", "consultor de marketing", "anúncio"],
        "subcategories": [
            {
                "name": "Gestão de Tráfego e Ads",
                "tags": ["gestor de tráfego", "tráfego pago", "google ads", "facebook ads", "instagram ads", "linkedin ads", "anúncio online", "campanha publicitária", "ppc", "links patrocinados", "remarketing"]
            },
            {
                "name": "Redes Sociais e Conteúdo",
                "tags": ["social media", "gestão de redes sociais", "instagram", "facebook", "tiktok", "criação de conteúdo", "post", "stories", "engajamento", "influenciador digital", "marketing de conteúdo"]
            },
            {
                "name": "SEO e Inbound Marketing",
                "tags": ["seo", "otimização de sites", "ranqueamento no google", "primeira página", "palavras-chave", "inbound marketing", "blog", "marketing de atração", "link building", "seo local"]
            },
            {
                "name": "Copywriting e Estratégia",
                "tags": ["copywriter", "copywriting", "redação publicitária", "texto persuasivo", "carta de vendas", "email marketing", "lançamento de produto", "funil de vendas", "gatilhos mentais", "storytelling"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Consultoria e Serviços Profissionais",
        "tags": ["consultoria", "assessoria", "especialista", "profissional liberal", "negócios", "gestão", "planejamento", "advogado", "contador", "arquiteto"],
        "subcategories": [
            {
                "name": "Jurídico",
                "tags": ["advogado", "advocacia", "direito", "consultoria jurídica", "processo", "contrato", "direito civil", "trabalhista", "tributário", "consumidor", "família", "divórcio", "inventário", "legalização"]
            },
            {
                "name": "Contabilidade e Finanças",
                "tags": ["contador", "contabilidade", "imposto de renda", "irpf", "abertura de empresa", "cnpj", "mei", "gestão financeira", "consultor financeiro", "folha de pagamento", "planejamento tributário", "declaração de impostos"]
            },
            {
                "name": "Arquitetura e Engenharia",
                "tags": ["arquiteto", "engenheiro civil", "projeto arquitetônico", "projeto estrutural", "planta baixa", "reforma", "design de interiores", "laudo técnico", "art", "rrt", "regularização de imóvel", "acompanhamento de obra", "autocad", "revit"]
            },
            {
                "name": "Consultoria de Negócios",
                "tags": ["consultor de negócios", "gestão empresarial", "plano de negócios", "estratégia", "marketing", "vendas", "processos", "otimização", "mentoria para empreendedores", "franquia"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Saúde e Bem-Estar",
        "tags": ["saúde", "bem-estar", "terapia", "tratamento", "cuidados", "qualidade de vida", "terapeuta", "clínica", "fitness", "corpo e mente"],
        "subcategories": [
            {
                "name": "Terapias e Psicologia",
                "tags": ["psicólogo", "terapeuta", "psicoterapia", "terapia de casal", "ansiedade", "depressão", "saúde mental", "coaching", "pnl", "terapia holística", "reiki", "constelação familiar"]
            },
            {
                "name": "Nutrição e Alimentação",
                "tags": ["nutricionista", "nutrólogo", "dieta", "plano alimentar", "reeducação alimentar", "emagrecimento", "nutrição esportiva", "nutrição funcional", "alimentação saudável", "ganho de massa"]
            },
            {
                "name": "Fitness e Atividade Física",
                "tags": ["personal trainer", "treinador físico", "educador físico", "treino funcional", "musculação", "pilates", "yoga", "preparador físico", "condicionamento", "corrida"]
            },
            {
                "name": "Fisioterapia e Reabilitação",
                "tags": ["fisioterapeuta", "fisioterapia", "rpg", "quiropraxia", "osteopatia", "reabilitação", "lesão", "dor nas costas", "ortopedia", "drenagem linfática", "pilates clínico"]
            },
            {
                "name": "Massoterapia",
                "tags": ["massoterapeuta", "massagista", "massagem relaxante", "massagem modeladora", "drenagem linfática", "shiatsu", "reflexologia", "liberação miofascial", "massagem desportiva"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Beleza e Estética",
        "tags": ["beleza", "estética", "cuidados pessoais", "salão de beleza", "clínica de estética", "visual", "imagem pessoal", "procedimento estético"],
        "subcategories": [
            {
                "name": "Cabelo",
                "tags": ["cabeleireiro", "hairstylist", "corte de cabelo", "coloração", "luzes", "mechas", "escova progressiva", "penteado", "tratamento capilar", "terapeuta capilar", "salão de beleza"]
            },
            {
                "name": "Manicure e Pedicure",
                "tags": ["manicure", "pedicure", "nail designer", "unha de gel", "fibra de vidro", "alongamento de unha", "esmaltação em gel", "spa dos pés", "unhas decoradas", "podologia"]
            },
            {
                "name": "Estética Facial e Corporal",
                "tags": ["esteticista", "limpeza de pele", "peeling", "microagulhamento", "drenagem linfática", "massagem modeladora", "tratamento para celulite", "estrias", "gordura localizada", "rejuvenescimento"]
            },
            {
                "name": "Maquiagem e Sobrancelhas",
                "tags": ["maquiador", "makeup artist", "maquiagem social", "maquiagem para noiva", "curso de automaquiagem", "design de sobrancelha", "micropigmentação", "microblading", "extensão de cílios", "lash lifting"]
            },
            {
                "name": "Depilação",
                "tags": ["depiladora", "depilação a cera", "depilação a laser", "fotodepilação", "depilação com linha", "depilação masculina", "virilha", "axila", "perna"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Educação e Aulas",
        "tags": ["educação", "aulas", "professor", "ensino", "aprendizado", "curso", "reforço escolar", "tutor", "aula particular", "mentoria"],
        "subcategories": [
            {
                "name": "Aulas Particulares",
                "tags": ["professor particular", "reforço escolar", "matemática", "física", "química", "português", "redação", "biologia", "história", "ajuda com dever de casa", "acompanhamento escolar"]
            },
            {
                "name": "Idiomas",
                "tags": ["professor de idiomas", "aula de inglês", "espanhol", "francês", "italiano", "alemão", "conversação", "preparatório para exames", "toefl", "ielts", "tradução"]
            },
            {
                "name": "Música e Arte",
                "tags": ["professor de música", "aula de violão", "guitarra", "piano", "teclado", "bateria", "canto", "teoria musical", "aula de desenho", "pintura", "artesanato"]
            },
            {
                "name": "Concursos e Vestibulares",
                "tags": ["preparatório para concurso", "vestibular", "enem", "professor para concurso", "mentoria de estudos", "revisão de matéria", "banca de redação", "aulas para oab"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Eventos e Festas",
        "tags": ["eventos", "festa", "celebração", "casamento", "aniversário", "corporativo", "produção de eventos", "organizador", "cerimonialista"],
        "subcategories": [
            {
                "name": "Organização e Cerimonial",
                "tags": ["organizador de eventos", "cerimonialista", "assessor de eventos", "planejamento de casamento", "festa de 15 anos", "evento corporativo", "produtor de eventos", "recepcionista"]
            },
            {
                "name": "Buffet e Gastronomia",
                "tags": ["buffet", "catering", "chef de cozinha", "cozinheiro", "churrasqueiro", "garçom", "barman", "bartender", "bolo decorado", "doces finos", "salgados", "coquetel"]
            },
            {
                "name": "Decoração e Ambientação",
                "tags": ["decorador de festas", "decoração de casamento", "arranjos florais", "design de eventos", "ambientação", "cenografia", "balões", "mesa do bolo", "aluguel de móveis para festa"]
            },
            {
                "name": "Música e Entretenimento",
                "tags": ["dj", "banda para eventos", "músico", "atração musical", "som e iluminação", "animador de festa", "mágico", "recreação infantil", "locutor"]
            },
            {
                "name": "Aluguel para Festas",
                "tags": ["aluguel de cadeira", "mesa", "toalha", "louça", "brinquedos", "pula-pula", "piscina de bolinhas", "som", "iluminação", "tendas", "material para festa"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Serviços Automotivos",
        "tags": ["automotivo", "carro", "veículo", "moto", "oficina mecânica", "auto center", "manutenção automotiva", "conserto de carro"],
        "subcategories": [
            {
                "name": "Mecânica Geral",
                "tags": ["mecânico", "oficina", "revisão veicular", "troca de óleo", "freios", "suspensão", "motor", "injeção eletrônica", "correia dentada", "diagnóstico veicular", "socorro mecânico"]
            },
            {
                "name": "Funilaria e Pintura",
                "tags": ["funileiro", "lanterneiro", "pintura automotiva", "martelinho de ouro", "micropintura", "polimento", "cristalização", "vitrificação", "reparo de arranhão", "batida", "para-choque"]
            },
            {
                "name": "Elétrica e Acessórios",
                "tags": ["eletricista automotivo", "bateria", "alternador", "motor de partida", "som automotivo", "alarme", "vidro elétrico", "insulfilm", "instalação de acessórios", "farol"]
            },
            {
                "name": "Estética Automotiva",
                "tags": ["lava rápido", "lavagem detalhada", "higienização interna", "limpeza de motor", "polimento de farol", "hidratação de couro", "estética automotiva", "detailer"]
            }
        ],
        "default_remote_execution": False
    },
    {
        "name": "Tradução e Conteúdo",
        "tags": ["tradução", "conteúdo", "redação", "revisão", "idiomas", "escrita", "localização", "intérprete", "linguística"],
        "subcategories": [
            {
                "name": "Tradução Técnica e Juramentada",
                "tags": ["tradutor", "tradução juramentada", "tradução técnica", "inglês", "espanhol", "documentos", "contratos", "manuais", "localização de software", "tradução simultânea"]
            },
            {
                "name": "Produção de Conteúdo e Redação",
                "tags": ["redator", "ghostwriter", "criação de conteúdo", "artigo para blog", "ebook", "roteiro", "texto para site", "jornalista", "comunicação"]
            },
            {
                "name": "Revisão e Formatação",
                "tags": ["revisor de texto", "revisão ortográfica", "gramatical", "normas abnt", "formatação de trabalho acadêmico", "tese", "dissertação", "preparação de originais"]
            }
        ],
        "default_remote_execution": True
    },
    {
        "name": "Serviços Domésticos e Gerais",
        "tags": ["doméstico", "casa", "residencial", "limpeza", "organização", "cuidados", "suporte residencial", "serviços gerais"],
        "subcategories": [
            {
                "name": "Limpeza Residencial e Comercial",
                "tags": ["diarista", "faxineira", "limpeza pesada", "limpeza pós-obra", "limpeza de escritório", "faxina", "passar roupa", "empresa de limpeza", "terceirização"]
            },
            {
                "name": "Organização de Ambientes",
                "tags": ["personal organizer", "organização de armários", "closet", "mudança", "organização de documentos", "quarto de bebê", "casa organizada", "método marie kondo"]
            },
            {
                "name": "Cuidadores",
                "tags": ["cuidador de idosos", "babá", "babysitter", "acompanhante hospitalar", "cuidador infantil", "folguista", "cuidados especiais"]
            },
            {
                "name": "Jardinagem e Paisagismo",
                "tags": ["jardineiro", "paisagista", "manutenção de jardim", "poda de árvore", "corte de grama", "projeto paisagístico", "horta em casa", "jardim vertical"]
            },
            {
                "name": "Pets",
                "tags": ["pet sitter", "dog walker", "passeador de cães", "adestrador", "banho e tosa", "hotel para cachorro", "táxi dog", "cuidador de animais"]
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
