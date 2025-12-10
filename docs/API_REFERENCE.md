## Agiliza Platform — API Reference

Base URL (production): https://agilizapro.cloud

Observações rápidas
- Autenticação: a maioria dos endpoints usa JWT Bearer (token de acesso). Faça login via `/auth/login` para obter `access_token` e envie no header `Authorization: Bearer <token>`.
- Rotas administrativas usam checagem adicional de role (`admin`).
- Existem endpoints HTML para o painel administrativo em `/system-admin` (templates).

-----------------------------

### Endpoints públicos / Autenticação

- POST /auth/register
  - Descrição: Registrar novo usuário
  - Body: `UserCreate`
  - Resposta: `User`

- POST /auth/login
  - Descrição: Login (form-data: `username` e `password` no padrão OAuth2PasswordRequestForm)
  - Resposta: `{ access_token, refresh_token, token_type }`

- POST /auth/refresh
  - Descrição: Gerar novo access_token a partir do refresh token (precisa de autenticação)


### Usuários (`/users`)

- GET /users/me
  - Descrição: Retorna dados do usuário autenticado
  - Auth: sim

- PUT /users/me
  - Descrição: Atualiza perfil do usuário autenticado
  - Body: `UserUpdate`
  - Auth: sim

- GET /users/professionals/nearby
  - Descrição: Buscar profissionais próximos (query: latitude, longitude, radius_km)
  - Auth: não (pode ser chamada sem auth, mas normalmente com)

- POST /users/address/geocode
  - Descrição: Geocodifica um endereço
  - Body: `AddressGeocode`
  - Auth: não

# Admin (`/users/admin/*`)
- GET /users/admin/  (listagem paginada)
- GET /users/admin/{user_id}
- PUT /users/admin/{user_id}
- DELETE /users/admin/{user_id}
  - Descrição: operações administrativas sobre usuários
  - Auth: admin


### Projetos (`/projects`)

- POST /projects/
  - Descrição: Criar novo projeto
  - Body: `ProjectCreate`
  - Observação: O campo `title` possui tamanho máximo de 80 caracteres.
  - Auth: sim

- GET /projects/
  - Descrição: Listar projetos com filtros (categoria, skills, budget, status, geo-params, etc.)
  - Auth: não

- GET /projects/nearby
  - Descrição: Listar projetos próximos (latitude, longitude, radius_km)
  - Auth: não

- GET /projects/{project_id}
  - Descrição: Buscar detalhes de um projeto
  - Auth: não (mas dados privados restritos a participantes)

- PUT /projects/{project_id}
  - Descrição: Atualizar projeto (apenas dono)
  - Body: `ProjectUpdate`
  - Auth: sim (owner)

# Admin (`/projects/admin/*`)
- GET /projects/admin/
- GET /projects/admin/{project_id}
- PUT /projects/admin/{project_id}
- DELETE /projects/admin/{project_id}
  - Auth: admin

- POST /projects/{project_id}/close
  - Descrição: Fechar projeto definindo budget final (apenas profissional autorizado)
  - Body: `ProjectClose`
  - Auth: sim

- POST /projects/{project_id}/evaluate
  - Descrição: Cliente avalia profissional após fechamento
  - Body: `EvaluationCreate`
  - Auth: sim (cliente)

- GET /projects/{project_id}/messages/download
  - Descrição: Fazer download de mensagens/documentos vinculados ao projeto (apenas participantes)
  - Auth: sim


### Contatos / Chat (`/contacts`)

- POST /contacts/{project_id}
  - Descrição: Criar contato / solicitar profissional para um projeto
  - Body: `ContactCreate`
  - Auth: sim (cliente)

- GET /contacts/history
  - Descrição: Histórico de contatos do usuário (query `user_type`)
  - Auth: sim

- PUT /contacts/{contact_id}/status
  - Descrição: Atualizar status de contato (aceitar/rejeitar, etc.)
  - Body: `ContactUpdate`
  - Auth: sim (participantes)

# Admin (`/contacts/admin/*`)
- GET /contacts/admin/
- GET /contacts/admin/{contact_id}
- PUT /contacts/admin/{contact_id}
- DELETE /contacts/admin/{contact_id}
- GET /contacts/admin/aggregated
  - Auth: admin


### Documentos (`/documents`)

- POST /documents/upload/{project_id}
  - Descrição: Upload de PDF (validação de assinaturas). Retorna `Document`
  - Body: multipart/form-data com arquivo PDF
  - Auth: sim (participantes)

- GET /documents/project/{project_id}
  - Descrição: Listar documentos de um projeto
  - Auth: sim (participantes)

- GET /documents/{document_id}
  - Descrição: Metadados do documento
  - Auth: sim (participantes)

- GET /documents/{document_id}/download
  - Descrição: Download do arquivo
  - Auth: sim (participantes)


### Uploads genéricos (`/uploads`)

- POST /uploads/media
  - Descrição: Upload de mídia (image/video/audio). Retorna `{ url, tags, filename, size, type }`
  - Body: multipart/form-data com `file`
  - Auth: sim


### Pagamentos (`/api/payments`)

OBS: esse router usa prefix `/api/payments`

- GET /api/payments/plans
  - Listar planos de assinatura disponíveis

- GET /api/payments/credit-packages
  - Listar pacotes de créditos

- GET /api/payments/featured-pricing
  - Listar preços para projetos destacados

- POST /api/payments/subscription
  - Criar pagamento de assinatura (PIX ou cartão)
  - Body: `SubscriptionPaymentRequest`
  - Auth: sim

- GET /api/payments/subscription/status
  - Verificar status da assinatura do usuário
  - Auth: sim

- POST /api/payments/subscription/cancel
  - Cancelar assinatura ativa
  - Auth: sim

- POST /api/payments/credits
  - Criar pagamento para pacote de créditos
  - Body: `CreditPackagePaymentRequest`
  - Auth: sim

- POST /api/payments/featured-project
  - Criar pagamento para destacar projeto
  - Body: `FeaturedProjectPaymentRequest`
  - Auth: sim

- GET /api/payments/status/{payment_id}
  - Verificar status de um pagamento
  - Auth: sim

- GET /api/payments/history
  - Histórico de pagamentos do usuário
  - Auth: sim


### Subscriptions (`/subscriptions`)

- GET /subscriptions/plans
  - Listar planos públicos

- POST /subscriptions/subscribe
  - Subscribir usuário a um plano (efetua pagamento simulado)
  - Body: `SubscriptionCreate`
  - Auth: sim

- GET /subscriptions/me
  - Retorna dados da assinatura do usuário
  - Auth: sim

- POST /subscriptions/add-credits
  - Adiciona créditos via pagamento (simulado)
  - Body: `AddCredits`
  - Auth: sim

# Admin (`/subscriptions/admin/*`)
- GET /subscriptions/admin/
- GET /subscriptions/admin/{subscription_id}
- PUT /subscriptions/admin/{subscription_id}
- DELETE /subscriptions/admin/{subscription_id}


### Webhooks (`/webhooks`)

- POST /webhooks/asaas
  - Descrição: Recebe webhooks do Asaas (processamento em background)
  - Auth: Não, mas valida assinatura `X-Asaas-Signature` se configurada


### Admin JSON API (`/api/admin`)

Principais endpoints (todos com prefix `/api/admin` e `Auth: admin`):

- GET /api/admin/users
- GET /api/admin/projects
- GET /api/admin/contacts
- GET /api/admin/subscriptions
- GET /api/admin/dashboard

Config endpoints (manage plans, credit packages, featured pricing):
- GET /api/admin/config/plans
- GET /api/admin/config/plans/{plan_id}
- POST /api/admin/config/plans
- PUT /api/admin/config/plans/{plan_id}
- DELETE /api/admin/config/plans/{plan_id}

- GET /api/admin/config/credit-packages
- GET /api/admin/config/credit-packages/{package_id}
- POST /api/admin/config/credit-packages
- PUT /api/admin/config/credit-packages/{package_id}
- DELETE /api/admin/config/credit-packages/{package_id}

- GET /api/admin/config/featured-pricing
- GET /api/admin/config/featured-pricing/{pricing_id}
- POST /api/admin/config/featured-pricing
- PUT /api/admin/config/featured-pricing/{pricing_id}
- DELETE /api/admin/config/featured-pricing/{pricing_id}


### Painel Admin (HTML) — `/system-admin` (templates)

- GET /system-admin/  (dashboard)
- GET /system-admin/users
- GET /system-admin/projects
- GET /system-admin/contacts
- GET /system-admin/subscriptions
- GET /system-admin/login  (página de login)
- POST /system-admin/login (form login)
- GET /system-admin/logout
- GET /system-admin/users/{user_id} (detalhe)


### WebSocket

- ws://<host>/ws/{user_id}?token=<JWT>
  - Descrição: conexão WebSocket autenticada por token na query string
  - Mensagens suportadas (JSON):
    - { type: 'subscribe_projects' }
    - { type: 'new_message', contact_id: '<id>', content: '...' }
    - { type: 'contact_update', contact_id: '<id>', status: '...' }


### Docs e Root

- GET /  -> { message: 'Professional Platform API' }
- GET /docs  -> Swagger UI (padrão)
- GET /custom-docs  -> Documentação customizada (HTML template)
- GET /openapi.json  -> OpenAPI spec


----

Notas finais
- Os modelos de request/response (Pydantic schemas) estão em `backend/app/schemas/` (por exemplo `user.py`, `project.py`, `document.py`, `subscription.py`). Use-os como referência de payloads.
- Endpoints marcados como `Auth: sim` exigem header `Authorization: Bearer <token>` salvo indicação contrária.
- Se quiser, eu gero automaticamente um arquivo CSV/JSON com todas as rotas extraídas do código ou exporto o `openapi.json` do servidor rodando — qual prefere?
