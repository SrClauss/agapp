# Mudança no Backend: Redirecionamento para Login em Requisições Não Autenticadas

## Descrição da Mudança
Encaminhar todas as requisições que retornarem código de não autenticado (401 Unauthorized) para redirecionamento automático à página de login.

Adicionalmente, renovar o token de autenticação a cada acesso a rota autenticada para manter a sessão ativa.

## Motivação
Melhorar a experiência do usuário ao lidar com sessões expiradas ou acessos não autorizados, redirecionando diretamente ao login em vez de mostrar erro.

## Implementação Proposta
- Modificar o middleware de autenticação no backend (FastAPI).
- Capturar exceções de `HTTPException` com status 401.
- Retornar um redirecionamento (302) para `/login` ou endpoint de login.
- Para renovação de token: Em rotas autenticadas, verificar o token atual e emitir um novo com expiração atualizada, retornando-o no header de resposta (ex: `Authorization: Bearer <novo_token>`).

## Código de Exemplo
```python
from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from app.core.security import create_access_token  # Supondo função para criar token

# No middleware ou handler de exceções
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401:
        return RedirectResponse(url="/login", status_code=302)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# Em dependência de autenticação (ex: get_current_user)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    # ... validação do token
    # Se válido, criar novo token
    new_token = create_access_token(data={"sub": user.username})
    # Retornar usuário e novo token (ou definir no response header)
    response.headers["Authorization"] = f"Bearer {new_token}"
    return user
```

## Próximos Passos
- Implementar no código.
- Testar com requisições não autenticadas.
- Verificar compatibilidade com frontend (se necessário).

## Status
Pendente - Aguardando decisão para implementar.