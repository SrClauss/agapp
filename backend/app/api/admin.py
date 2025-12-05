from fastapi import APIRouter, Depends, Request, HTTPException, Form, status, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import List
import logging
from datetime import datetime
from app.core.database import get_database
from app.core.security import get_current_admin_user, create_access_token, verify_password, get_current_user_from_request
from app.crud.user import get_users, get_user_by_email, get_user_in_db_by_email, get_user, toggle_user_status, update_user_profile, delete_user, get_user_stats
from app.crud.project import get_projects
from app.crud.contact import get_contacts
from app.crud.subscription import get_subscriptions
from app.crud.category import get_categories, get_category, create_category, update_category, delete_category, delete_category_permanent
from app.models.category import CategoryCreate, CategoryUpdate
from app.schemas.user import User, Token
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from typing import Optional, Literal
from fastapi import status as http_status

router = APIRouter()

# Rate limiter específico para admin (mais restritivo)
admin_limiter = Limiter(key_func=get_remote_address)

# Configurar logging de segurança
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.WARNING)

templates = Jinja2Templates(directory="templates")

def validate_admin_request(request: Request) -> bool:
    """Valida se a requisição para admin parece legítima"""
    # Verificar User-Agent suspeito
    user_agent = request.headers.get("user-agent", "").lower()
    suspicious_agents = ["bot", "crawler", "spider", "scraper", "python-requests"]
    
    if any(agent in user_agent for agent in suspicious_agents):
        return False
    
    # Verificar se tem referrer (para requisições POST sem referrer pode ser suspeito)
    referrer = request.headers.get("referer", "")
    if not referrer and request.method in ["POST", "PUT", "DELETE"]:
        # Requisições POST sem referrer podem ser suspeitas
        return False
    
    return True

@router.get("/ads", response_class=HTMLResponse)
async def ads_admin_panel(
    request: Request,
    current_user: User = Depends(get_current_user_from_request)
):
    """Painel de gerenciamento de publicidade"""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return templates.TemplateResponse("admin/ads.html", {
        "request": request,
        "current_user": current_user
    })

# NOTE: Ad management API routes have been moved to app/api/endpoints/ads.py
# Use the following endpoints instead:
# - GET /ads-admin/locations - List all ad locations
# - POST /ads-admin/upload/{location} - Upload files
# - DELETE /ads-admin/delete-all/{location} - Delete all files
# - DELETE /ads-admin/delete-file/{location}/{filename} - Delete specific file
# - GET /ads-admin/preview/{location} - Preview ad content

@router.get("/", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Get statistics
    users_count = await db.users.count_documents({})
    projects_count = await db.projects.count_documents({})
    contacts_count = await db.contacts.count_documents({})
    subscriptions_count = await db.subscriptions.count_documents({})

    # Get recent items
    recent_users = await get_users(db, limit=5)
    recent_projects = await get_projects(db, limit=5)
    recent_contacts = await get_contacts(db, limit=5)
    recent_subscriptions = await get_subscriptions(db, limit=5)

    return templates.TemplateResponse("admin/dashboard.html", {
        "request": request,
        "current_user": current_user,
        "stats": {
            "users": users_count,
            "projects": projects_count,
            "contacts": contacts_count,
            "subscriptions": subscriptions_count
        },
        "recent_users": recent_users,
        "recent_projects": recent_projects,
        "recent_contacts": recent_contacts,
        "recent_subscriptions": recent_subscriptions
    })

@router.get("/users", response_class=HTMLResponse)
async def admin_users(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    role: str = "",
    status: str = "",
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Build query filter
    query_filter = {}
    
    if search:
        query_filter["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    if role:
        query_filter["roles"] = role
    
    if status:
        if status == "active":
            query_filter["is_active"] = True
        elif status == "inactive":
            query_filter["is_active"] = False
    
    users = await get_users(db, skip=skip, limit=limit, query_filter=query_filter)
    total_users = await db.users.count_documents(query_filter)
    total_pages = (total_users + limit - 1) // limit  # Ceiling division
    # pagination helpers for template (compute in Python to avoid relying on jinja globals)
    current_page = (skip // limit) + 1
    page_start = max(1, current_page - 2)
    page_end = min(total_pages, current_page + 2)
    page_range = list(range(page_start, page_end + 1))

    return templates.TemplateResponse("admin/users.html", {
        "request": request,
        "current_user": current_user,
        "users": users,
        "skip": skip,
        "limit": limit,
        "total": total_users,
        "total_pages": total_pages,
        "current_page": current_page,
        "page_start": page_start,
        "page_end": page_end,
        "page_range": page_range,
        "search": search,
        "role": role,
        "status": status
    })

@router.get("/projects", response_class=HTMLResponse)
async def admin_projects(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    status: str = "",
    client_id: str = "",
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Build query filter
    query_filter = {}
    
    if search:
        query_filter["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query_filter["status"] = status

    if client_id:
        query_filter["client_id"] = client_id
    
    projects = await get_projects(db, skip=skip, limit=limit, filters=None, query_filter=query_filter)
    total_projects = await db.projects.count_documents(query_filter)
    total_pages = (total_projects + limit - 1) // limit

    # Get clients for filter dropdown
    clients = await get_users(db, query_filter={"roles": "client"})

    return templates.TemplateResponse("admin/projects.html", {
        "request": request,
        "current_user": current_user,
        "projects": projects,
        "clients": clients,
        "skip": skip,
        "limit": limit,
        "total": total_projects,
        "total_pages": total_pages,
        "current_page": (skip // limit) + 1,
        "search": search,
        "status": status,
        "client_id": client_id
    })

@router.get("/contacts", response_class=HTMLResponse)
async def admin_contacts(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    status: str = "",
    professional_id: str = "",
    client_id: str = "",
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Build query filter
    query_filter = {}
    
    if search:
        query_filter["$or"] = [
            {"message": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query_filter["status"] = status
    
    if professional_id:
        query_filter["professional_id"] = professional_id
    
    if client_id:
        query_filter["client_id"] = client_id
    
    contacts = await get_contacts(db, skip=skip, limit=limit, query_filter=query_filter)
    total_contacts = await db.contacts.count_documents(query_filter)
    total_pages = (total_contacts + limit - 1) // limit

    # Get professionals and clients for filter dropdowns
    professionals = await get_users(db, query_filter={"roles": "professional"})
    clients = await get_users(db, query_filter={"roles": "client"})

    print("DEBUG: Contatos carregados:", contacts)  # Debug line to check loaded contacts

    return templates.TemplateResponse("admin/contacts.html", {
        "request": request,
        "current_user": current_user,
        "contacts": contacts,
        "professionals": professionals,
        "clients": clients,
        "skip": skip,
        "limit": limit,
        "total": total_contacts,
        "total_pages": total_pages,
        "current_page": (skip // limit) + 1,
        "search": search,
        "status": status,
        "professional_id": professional_id,
        "client_id": client_id
    })

@router.get("/subscriptions", response_class=HTMLResponse)
async def admin_subscriptions(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    status: str = "",
    plan_name: str = "",
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Build query filter
    query_filter = {}
    
    if search:
        # Para subscriptions, buscar por user_id ou outros campos relevantes
        query_filter["$or"] = [
            {"user_id": {"$regex": search, "$options": "i"}},
            {"plan_name": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query_filter["status"] = status
    
    if plan_name:
        query_filter["plan_name"] = plan_name
    
    subscriptions = await get_subscriptions(db, skip=skip, limit=limit, query_filter=query_filter)
    total_subscriptions = await db.subscriptions.count_documents(query_filter)
    total_pages = (total_subscriptions + limit - 1) // limit

    return templates.TemplateResponse("admin/subscriptions.html", {
        "request": request,
        "current_user": current_user,
        "subscriptions": subscriptions,
        "skip": skip,
        "limit": limit,
        "total": total_subscriptions,
        "total_pages": total_pages,
        "current_page": (skip // limit) + 1,
        "search": search,
        "status": status,
        "plan_name": plan_name
    })

@router.get("/login", response_class=HTMLResponse)
@admin_limiter.limit("5/minute")
async def admin_login_page(request: Request):
    return templates.TemplateResponse("admin/login.html", {"request": request})

@router.post("/login")
@admin_limiter.limit("3/minute")
async def admin_login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    website: str = Form(None),  # Honeypot field
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Verificar honeypot - se preenchido, é um bot
    if website and website.strip():
        print(f"SECURITY: BOT DETECTED - Honeypot triggered from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requisição inválida detectada",
        )
    
    # Validação de segurança adicional
    if not validate_admin_request(request):
        print(f"SECURITY: SUSPICIOUS REQUEST - Validation failed from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Requisição suspeita detectada",
        )
    user = await get_user_in_db_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        print(f"SECURITY: FAILED LOGIN ATTEMPT - Invalid credentials for email: {form_data.username} from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user has admin role
    if "admin" not in user.roles:
        print(f"SECURITY: FAILED LOGIN ATTEMPT - Non-admin user {form_data.username} from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores podem acessar o painel.",
        )
    
    print(f"SECURITY: SUCCESSFUL ADMIN LOGIN - User: {form_data.username} from IP: {request.client.host}")
    access_token = create_access_token(subject=str(user.id))

    # If AJAX request (fetch), return JSON and set cookie on JSON response
    is_ajax = request.headers.get("x-requested-with") == "XMLHttpRequest" or "application/json" in request.headers.get("accept", "")

    if is_ajax:
        resp = JSONResponse(content={"success": True, "message": "Autenticado"})
        resp.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,
            max_age=1800,
            expires=1800,
            samesite="lax",
            path="/",
        )
        return resp

    # Fallback: normal browser POST -> redirect (keeps previous behaviour)
    response = RedirectResponse(url="/system-admin", status_code=302)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=1800,  # 30 minutes
        expires=1800,
        samesite="lax",
        path="/",
    )
    return response

@router.get("/logout")
async def admin_logout():
    """Logout do painel administrativo - limpa cookie e redireciona para login admin"""
    response = RedirectResponse(url="/system-admin/login", status_code=302)
    response.delete_cookie(
        key="access_token",
        path="/",
        domain=None,
        samesite="lax"
    )
    return response

@router.get("/users/{user_id}", response_class=HTMLResponse)
async def admin_user_detail(
    request: Request,
    user_id: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Visualização detalhada de um usuário com estatísticas"""
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Obter estatísticas do usuário
    stats = await get_user_stats(db, user_id)
    
    # Obter projetos do usuário (limitado aos 10 mais recentes)
    projects = []
    async for project in db.projects.find({"client_id": user_id}).sort("created_at", -1).limit(10):
        if isinstance(project.get("_id"), ObjectId):
            project["_id"] = str(project["_id"])
        projects.append(project)
    
    # Obter contatos recentes (10 mais recentes)
    contacts = []
    async for contact in db.contacts.find({"$or": [{"client_id": user_id}, {"professional_id": user_id}]}).sort("created_at", -1).limit(10):
        if isinstance(contact.get("_id"), ObjectId):
            contact["_id"] = str(contact["_id"])
        contacts.append(contact)
    
    return templates.TemplateResponse("admin/user_detail.html", {
        "request": request,
        "current_user": current_user,
        "user": user,
        "stats": stats,
        "projects": projects,
        "contacts": contacts
    })

@router.get("/users/{user_id}/edit", response_class=HTMLResponse)
async def admin_user_edit_page(
    request: Request,
    user_id: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Página de edição de usuário"""
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return templates.TemplateResponse("admin/user_edit.html", {
        "request": request,
        "current_user": current_user,
        "user": user
    })

@router.post("/users/{user_id}/edit")
async def admin_user_edit(
    request: Request,
    user_id: str,
    full_name: str = Form(...),
    phone: str = Form(None),
    roles: List[str] = Form(...),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Processa a edição de um usuário"""
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    update_data = {
        "full_name": full_name,
        "phone": phone if phone else None,
        "roles": roles
    }
    
    await update_user_profile(db, user_id, update_data)
    
    return RedirectResponse(url=f"/system-admin/users/{user_id}", status_code=303)

@router.post("/users/{user_id}/toggle-status")
async def admin_user_toggle_status(
    user_id: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Alterna o status ativo/inativo de um usuário"""
    user = await toggle_user_status(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return RedirectResponse(url="/system-admin/users", status_code=303)

@router.post("/users/{user_id}/delete")
async def admin_user_delete(
    user_id: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Exclui um usuário"""
    try:
        deleted = await delete_user(db, user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        return RedirectResponse(url="/system-admin/users", status_code=303)
    except Exception as e:
        if "last admin" in str(e).lower():
            raise HTTPException(status_code=400, detail="Não é possível excluir o último administrador")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config", response_class=HTMLResponse)
async def admin_config(
    request: Request,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Página de configurações do sistema"""
    # Buscar todas as configurações
    plans = await db.plan_configs.find({"is_active": True}).to_list(length=100)
    packages = await db.credit_packages.find().sort("sort_order", 1).to_list(length=100)
    featured_pricings = await db.featured_pricings.find().sort("duration_days", 1).to_list(length=100)

    return templates.TemplateResponse("admin/config.html", {
        "request": request,
        "current_user": current_user,
        "plans": plans,
        "packages": packages,
        "featured_pricings": featured_pricings
    })

@router.get("/categories", response_class=HTMLResponse)
async def admin_categories(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Página de gerenciamento de categorias"""
    categories = await get_categories(db, skip=skip, limit=limit, active_only=False)
    total_categories = await db.categories.count_documents({})

    # Converter subcategorias para dict para serialização JSON no template
    categories_dict = []
    for cat in categories:
        cat_dict = cat.dict()
        cat_dict['_id'] = cat.id
        categories_dict.append(cat_dict)

    return templates.TemplateResponse("admin/categories.html", {
        "request": request,
        "current_user": current_user,
        "categories": categories_dict,
        "total": total_categories,
        "skip": skip,
        "limit": limit
    })

@router.post("/categories/create")
async def admin_create_category(
    request: Request,
    name: str = Form(...),
    tags: str = Form(""),
    subcategories_data: str = Form(""),
    default_remote_execution: bool = Form(False),
    icon_name: str = Form(""),
    icon_library: str = Form(""),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Criar uma nova categoria via formulário"""
    from app.models.category import Subcategory
    import json

    # Processar tags da categoria principal
    tags_list = [t.strip() for t in tags.split(',') if t.strip()]

    # Processar subcategorias com tags (formato JSON)
    subcategories_list = []
    if subcategories_data:
        try:
            subs_json = json.loads(subcategories_data)
            for sub in subs_json:
                subcategories_list.append(Subcategory(
                    name=sub.get("name", ""),
                    tags=sub.get("tags", [])
                ))
        except:
            pass

    category_data = CategoryCreate(
        name=name,
        tags=tags_list,
        subcategories=subcategories_list,
        icon_name=icon_name.strip() if icon_name.strip() else None,
        icon_library=icon_library.strip() if icon_library.strip() else None
    )

    # Create category
    category = await create_category(db, category_data)

    # Update with default_remote_execution if set
    if default_remote_execution:
        await update_category(db, category.id, CategoryUpdate(default_remote_execution=True))

    return RedirectResponse(url="/system-admin/categories", status_code=303)

@router.post("/categories/{category_id}/edit")
async def admin_edit_category(
    request: Request,
    category_id: str,
    name: str = Form(...),
    tags: str = Form(""),
    subcategories_data: str = Form(""),
    default_remote_execution: bool = Form(False),
    icon_name: str = Form(""),
    icon_library: str = Form(""),
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Editar uma categoria existente via formulário"""
    from app.models.category import Subcategory
    import json

    # Processar tags da categoria principal
    tags_list = [t.strip() for t in tags.split(',') if t.strip()]

    # Processar subcategorias com tags (formato JSON)
    subcategories_list = []
    if subcategories_data:
        try:
            subs_json = json.loads(subcategories_data)
            for sub in subs_json:
                subcategories_list.append(Subcategory(
                    name=sub.get("name", ""),
                    tags=sub.get("tags", [])
                ))
        except:
            pass

    category_data = CategoryUpdate(
        name=name,
        tags=tags_list,
        subcategories=subcategories_list,
        default_remote_execution=default_remote_execution,
        icon_name=icon_name.strip() if icon_name.strip() else None,
        icon_library=icon_library.strip() if icon_library.strip() else None
    )

    await update_category(db, category_id, category_data)

    return RedirectResponse(url="/system-admin/categories", status_code=303)

@router.post("/categories/{category_id}/delete")
async def admin_delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user_from_request),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Deletar uma categoria"""
    deleted = await delete_category(db, category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    return RedirectResponse(url="/system-admin/categories", status_code=303)


@router.post("/categories/{category_id}/delete-permanent")
async def admin_delete_category_permanent(
    category_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Deletar uma categoria permanentemente (apenas admin)."""
    deleted = await delete_category_permanent(db, category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    return RedirectResponse(url="/system-admin/categories", status_code=303)


# NOTE: Public ad endpoints have been moved to app/api/endpoints/ads.py
# Use the following public endpoints instead:
# - GET /ads/public/publi-screen-client - Get client full-screen ad
# - GET /ads/public/publi-screen-professional - Get professional full-screen ad
# - GET /ads/public/banner-client-home - Get client home banner ad
# - GET /ads/public/banner-professional-home - Get professional home banner ad
# - POST /ads/public/click/{location} - Track ad click