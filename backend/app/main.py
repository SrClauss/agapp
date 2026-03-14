from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient
from app.api.endpoints import auth, users, projects, subscriptions, uploads, documents, admin_api, system_config_api, payments, webhooks, turnstile, categories, contract_templates, attendant_auth, support, ads, search, contacts
from app.api.endpoints import professional_api
from app.api.admin import router as admin_router
from app.api.professional import router as professional_router
from app.api.websockets.routes import router as websocket_router
from app.core.logging_middleware import CriticalEndpointLoggingMiddleware

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
    redirect_slashes=True,
)

# Configurar rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Logging middleware para endpoints críticos
app.add_middleware(CriticalEndpointLoggingMiddleware)

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

# Exception handler for 401 redirects
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401:
        return RedirectResponse(url="/login", status_code=302)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(contract_templates.router, prefix="/contract-templates", tags=["contract-templates"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
app.include_router(payments.router, tags=["payments"])
app.include_router(webhooks.router, tags=["webhooks"])
app.include_router(turnstile.router, prefix="/auth", tags=["authentication"])
app.include_router(admin_router, prefix="/system-admin", tags=["admin"])
app.include_router(professional_router, prefix="/professional", tags=["professional"])
# System config API (admin)
app.include_router(system_config_api.router, prefix="/api/admin")
# API endpoint for professional stats (mobile expects /api/professional/stats)
app.include_router(professional_api.router)
app.include_router(admin_api.router, tags=["admin-api"])
app.include_router(websocket_router, tags=["websockets"])
app.include_router(support.router, prefix="/support", tags=["support"])
app.include_router(attendant_auth.router, prefix="/attendant", tags=["attendant"])
app.include_router(ads.router, prefix="/ads", tags=["advertisements"])
app.include_router(ads.admin_router, prefix="/ads-admin", tags=["advertisements-admin"])
app.include_router(ads.mobile_router, prefix="/system-admin/api/public/ads")
app.include_router(ads.mobile_router, prefix="/ads-mobile", tags=["ads-mobile"])
app.include_router(contacts.router, tags=["contacts"])

# Expor rotas também sob o prefixo /api para compatibilidade com clientes e testes
app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(projects.router, prefix="/api/projects")
app.include_router(payments.router, prefix="/api/payments")
app.include_router(webhooks.router, prefix="/api/webhooks")
app.include_router(admin_api.router, prefix="/api/admin")
app.include_router(professional_api.router, prefix="/api/professional")
app.include_router(support.router, prefix="/api/support")
app.include_router(uploads.router, prefix="/api/uploads")
app.include_router(documents.router, prefix="/api/documents")
app.include_router(categories.router, prefix="/api/categories")
app.include_router(contract_templates.router, prefix="/api/contract-templates")
app.include_router(contacts.router, prefix="/api", tags=["contacts"])

# Mount ad static files after including the ads router so the router's
# dynamic endpoints are evaluated before the StaticFiles handler.
app.mount("/ads", StaticFiles(directory="ads"), name="ads")

@app.on_event("startup")
async def startup_event():
    # Verificar conexão com banco de dados
    from app.core import database as dbmod
    from app.core.config import settings

    try:
        # Recriar cliente e database no loop do servidor (evita problemas de event loop em testes)
        dbmod.client = AsyncIOMotorClient(settings.mongodb_url)
        dbmod.database = dbmod.client[settings.database_name]
        database = dbmod.database
        # Testar conexão
        await database.command("ping")
        print("Conexão com MongoDB estabelecida.")
    except Exception as e:
        print(f"Erro ao conectar com MongoDB: {e}")
        # Continuar sem interromper (alguns testes usam mocks/overrides do get_database)
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
    await database.lead_events.create_index("project_id")
    await database.lead_events.create_index("contact_id")
    await database.lead_events.create_index("professional_id")
    await database.lead_events.create_index("created_at")
    await database.client_evaluations.create_index("client_id")
    await database.client_evaluations.create_index("professional_id")
    await database.client_evaluations.create_index("project_id")
    # A criação do admin é feita via script de inicialização do container (mongo-init)
    # Ensure system configuration singleton exists
    try:
        from app.crud import config as config_crud
        await config_crud.get_system_config(database)
    except Exception:
        pass

    # Verificar e criar webhook 'Pagamento Confirmado' no Asaas se necessário
    try:
        from app.services.asaas import asaas_service
        webhooks = await asaas_service.list_webhooks()
        webhook_exists = any(w.get("name") == "Pagamento Confirmado" for w in webhooks)
        if not webhook_exists:
            webhook_token = settings.asaas_webhook_token
            await asaas_service.create_webhook(
                name="Pagamento Confirmado",
                url=settings.asaas_webhook_url,
                events=["PAYMENT_CONFIRMED"],
                token=webhook_token,
            )
            print("Webhook 'Pagamento Confirmado' criado no Asaas.")
        else:
            print("Webhook 'Pagamento Confirmado' já existe no Asaas.")
    except Exception as e:
        print(f"Aviso: não foi possível verificar/criar webhook no Asaas: {e}")

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