from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.api.endpoints import auth, users, projects, contacts, subscriptions, uploads, documents, admin_api, payments, webhooks
from app.api.admin import router as admin_router
from app.api.websockets.routes import router as websocket_router

app = FastAPI(
    title="Professional Platform API",
    description="API for connecting clients and professionals",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configurar templates
templates = Jinja2Templates(directory="templates")

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
app.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
app.include_router(payments.router, tags=["payments"])
app.include_router(webhooks.router, tags=["webhooks"])
app.include_router(admin_router, prefix="/system-admin", tags=["admin"])
app.include_router(admin_api.router, tags=["admin-api"])
app.include_router(websocket_router, tags=["websockets"])

# Endpoint para documentação customizada
@app.get("/custom-docs", response_class=HTMLResponse, tags=["documentation"])
async def custom_swagger_docs(request: Request):
    """Documentação customizada da API com informações adicionais"""
    return templates.TemplateResponse("custom_swagger.html", {
        "request": request,
        "title": "Agiliza Platform API",
        "description": "Plataforma que conecta clientes e profissionais",
        "openapi_url": "/openapi.json"
    })

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
    # A criação do admin é feita via script de inicialização do container (mongo-init)

@app.get("/")
async def root():
    return {"message": "Professional Platform API"}