from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.api.endpoints import auth, users, projects, contacts, subscriptions, uploads, documents, admin_api, payments, webhooks, turnstile, categories, contract_templates, attendant_auth, support, ads, search
from app.api.admin import router as admin_router
from app.api.professional import router as professional_router
from app.api.websockets.routes import router as websocket_router

# Tags metadata para organizar a documentação
tags_metadata = [
    {
        "name": "authentication",
        "description": "Operações de autenticação e registro de usuários. Utilize JWT Bearer tokens para autenticação.",
    },
    {
        "name": "users",
        "description": "Gerenciamento de usuários, perfis e busca de profissionais próximos com geolocalização.",
    },
    {
        "name": "projects",
        "description": "Criação, listagem e gerenciamento de projetos. Suporta busca por filtros, categoria, skills e geolocalização.",
    },
    {
        "name": "categories",
        "description": "Gerenciamento de categorias e subcategorias de projetos.",
    },
    {
        "name": "search",
        "description": "Busca inteligente de categorias e subcategorias com sugestões em tempo real.",
    },
    {
        "name": "contacts",
        "description": "Sistema de contatos entre clientes e profissionais. Gerencia solicitações e status de conexões.",
    },
    {
        "name": "documents",
        "description": "Upload e gerenciamento de documentos PDF com validação de assinaturas digitais.",
    },
    {
        "name": "contract-templates",
        "description": "Gerenciamento de templates de contratos. Permite importar textos e gerar contratos personalizados.",
    },
    {
        "name": "uploads",
        "description": "Upload de mídia (imagens, vídeos e áudio) para a plataforma.",
    },
    {
        "name": "payments",
        "description": "Sistema de pagamentos integrado com Asaas. Gerencia assinaturas, pacotes de créditos e projetos destacados.",
    },
    {
        "name": "webhooks",
        "description": "Webhooks para integração com serviços externos (Asaas, etc).",
    },
    {
        "name": "admin",
        "description": "Painel administrativo HTML com interface web para gerenciamento da plataforma.",
    },
    {
        "name": "admin-api",
        "description": "API JSON administrativa para gerenciamento de usuários, projetos, contatos, assinaturas e configurações.",
    },
    {
        "name": "professional",
        "description": "Painel do profissional com dashboard, mapa de projetos com geolocalização e gerenciamento de perfil.",
    },
    {
        "name": "websockets",
        "description": "Conexões WebSocket para comunicação em tempo real, notificações e chat.",
    },
    {
        "name": "support",
        "description": "Sistema de atendimento ao cliente (SAC). Permite criar tickets, enviar mensagens e acompanhar status.",
    },
    {
        "name": "attendant",
        "description": "Sistema de autenticação e gerenciamento de atendentes do SAC.",
    },
    {
        "name": "advertisements",
        "description": "Sistema de publicidade (PubliScreens e Banners). Gerencia conteúdo HTML/CSS/JS para exibição no app mobile.",
    },
]

app = FastAPI(
    title="Agiliza Platform API",
    description="""
# Plataforma Profissional Agiliza

API completa para conectar clientes e profissionais de forma eficiente e segura.

## 🚀 Funcionalidades Principais

* **🔐 Autenticação JWT** - Sistema seguro com access e refresh tokens
* **📍 Geolocalização** - Integração com Google Maps para busca por proximidade
* **💬 WebSockets** - Comunicação em tempo real para chat e notificações
* **💳 Pagamentos Asaas** - Processamento de pagamentos (PIX e cartão)
* **📄 Documentos** - Upload de PDFs com validação de assinaturas digitais
* **🗄️ MongoDB** - Banco de dados NoSQL otimizado com índices geoespaciais
* **📊 Sistema de Créditos** - Controle de uso da plataforma por créditos
* **👨‍💼 Painel Admin** - Interface administrativa completa

## 🔑 Autenticação

A maioria dos endpoints requer autenticação via JWT. Para obter um token:

1. Faça login via `POST /auth/login`
2. Use o `access_token` retornado no header: `Authorization: Bearer <token>`
3. Renove o token quando necessário via `POST /auth/refresh`

## 📡 WebSocket

Conecte-se via WebSocket para comunicação em tempo real:
```
ws://<host>/ws/{user_id}?token=<JWT>
```

Tipos de mensagens suportadas:
- `subscribe_projects` - Inscrever-se em atualizações
- `new_message` - Enviar mensagens
- `contact_update` - Atualizar status de contatos

## 🌐 Base URL

**Produção:** https://agilizapro.cloud
""",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=tags_metadata,
    contact={
        "name": "Agiliza Platform Support",
        "url": "https://agilizapro.cloud",
    },
    license_info={
        "name": "Proprietary",
    },
)

# Configurar rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configurar templates e static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
# Mount ad static files so that /ads/<location>/index.html can be served directly
# NOTE: the mount for /ads is added after the ads router so dynamic routes
# (rendering endpoints) take precedence over static file serving.

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(contract_templates.router, prefix="/contract-templates", tags=["contract-templates"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
app.include_router(payments.router, tags=["payments"])
app.include_router(webhooks.router, tags=["webhooks"])
app.include_router(turnstile.router, prefix="/auth", tags=["authentication"])
app.include_router(admin_router, prefix="/system-admin", tags=["admin"])
app.include_router(professional_router, prefix="/professional", tags=["professional"])
app.include_router(admin_api.router, tags=["admin-api"])
app.include_router(websocket_router, tags=["websockets"])
app.include_router(support.router, prefix="/support", tags=["support"])
app.include_router(attendant_auth.router, prefix="/attendant", tags=["attendant"])
app.include_router(ads.router, prefix="/ads", tags=["advertisements"])
app.include_router(ads.admin_router, prefix="/ads-admin", tags=["advertisements-admin"])
app.include_router(ads.mobile_router, prefix="/system-admin/api/public/ads")

# Mount ad static files after including the ads router so the router's
# dynamic endpoints are evaluated before the StaticFiles handler.
app.mount("/ads", StaticFiles(directory="ads"), name="ads")

@app.on_event("startup")
async def startup_event():
    # Verificar conexão com banco de dados
    from app.core.database import database
    try:
        # Testar conexão
        await database.command("ping")
        print("Conexão com MongoDB estabelecida.")
    except Exception as e:
        print(f"Erro ao conectar com MongoDB: {e}")
        return
    
    # Create indexes
    await database.users.create_index("email", unique=True)
    await database.users.create_index([("coordinates", "2dsphere")])
    await database.projects.create_index([("location.coordinates", "2dsphere")])
    await database.projects.create_index("client_id")
    await database.projects.create_index("status")
    await database.projects.create_index("is_featured")
    await database.categories.create_index("name", unique=True)
    await database.categories.create_index("is_active")
    await database.contacts.create_index("professional_id")
    await database.contacts.create_index("project_id")
    await database.subscriptions.create_index("user_id")
    await database.subscriptions.create_index("status")
    await database.plan_configs.create_index("is_active")
    await database.credit_packages.create_index("is_active")
    await database.credit_packages.create_index("sort_order")
    await database.featured_pricings.create_index("duration_days")
    await database.featured_pricings.create_index("is_active")
    await database.payment_webhooks.create_index("payment_id")
    await database.payment_webhooks.create_index("processed")
    await database.credit_transactions.create_index("user_id")
    await database.attendants.create_index("email", unique=True)
    await database.attendants.create_index("is_active")
    await database.attendants.create_index("is_online")
    await database.support_tickets.create_index("user_id")
    await database.support_tickets.create_index("attendant_id")
    await database.support_tickets.create_index("status")
    await database.support_tickets.create_index("category")
    await database.support_tickets.create_index("created_at")
    # A criação do admin é feita via script de inicialização do container (mongo-init)

@app.get("/")
async def root():
    return {"message": "Professional Platform API"}

@app.get("/turnstile", response_class=HTMLResponse)
async def turnstile_page(request: Request):
    """
    Página HTML com o widget Cloudflare Turnstile.

    Esta página é carregada em um WebView no app mobile para obter
    o token de verificação do usuário.
    """
    return templates.TemplateResponse(
        "turnstile.html",
        {
            "request": request,
            "site_key": settings.turnstile_site_key
        }
    )