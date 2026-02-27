# AgApp — Marketplace de Serviços

**Agiliza Platform** conecta clientes com profissionais de serviços. Clientes publicam projetos e profissionais consomem créditos para obter leads e entrar em contato.

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Arquitetura](#-arquitetura)
3. [Estrutura do Projeto](#-estrutura-do-projeto)
4. [Fluxo da Aplicação](#-fluxo-da-aplicação)
5. [Funcionalidades Implementadas](#-funcionalidades-implementadas)
6. [API — Endpoints Principais](#-api--endpoints-principais)
7. [Telas do App Mobile](#-telas-do-app-mobile)
8. [Componentes Reutilizáveis](#-componentes-reutilizáveis)
9. [Testes Automatizados](#-testes-automatizados)
10. [Configuração](#-configuração)
11. [Background Jobs](#-background-jobs)
12. [Segurança](#-segurança)
13. [Monitoramento e Logs](#-monitoramento-e-logs)
14. [Deploy](#-deploy)
15. [Documentação Adicional](#-documentação-adicional)
16. [Roadmap](#-roadmap)

---

## 🌐 Visão Geral

| Camada | Tecnologia |
|--------|-----------|
| Backend API | FastAPI (Python 3.12) |
| Banco de Dados | MongoDB + Motor (driver assíncrono) |
| Autenticação | JWT + Google Sign-In + Cloudflare Turnstile |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Pagamentos | Asaas (PIX e Cartão de Crédito) |
| Chat em tempo real | WebSockets (FastAPI) |
| App Mobile | React Native + Expo |
| Estado Global | Zustand |
| Navegação | React Navigation |
| UI Mobile | React Native Paper |
| Mapas | React Native Maps |

**URL de Produção:** https://agilizapro.cloud  
**Documentação Interativa da API:** https://agilizapro.cloud/docs

---

## 🏗️ Arquitetura

```
┌──────────────────────────────┐
│       App Mobile (Expo)      │
│  React Native + Zustand      │
└──────────────┬───────────────┘
               │ HTTPS / WebSocket
┌──────────────▼───────────────┐
│     Backend (FastAPI)        │
│  Python 3.12 + Motor         │
├──────────────────────────────┤
│  • REST API (/api/...)       │
│  • WebSocket (/ws/{user_id}) │
│  • Admin HTML (/system-admin)│
│  • Professional Panel        │
└──────────────┬───────────────┘
               │
       ┌───────┼──────────┐
       ▼       ▼          ▼
   MongoDB  Asaas      Firebase
  (dados)  (pagtos)    (push)
```

---

## 📂 Estrutura do Projeto

```
agapp/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin.py            # Painel admin HTML
│   │   │   ├── professional.py     # Painel do profissional
│   │   │   ├── endpoints/          # Endpoints REST
│   │   │   │   ├── auth.py         # Autenticação
│   │   │   │   ├── users.py        # Usuários e perfis
│   │   │   │   ├── projects.py     # Projetos
│   │   │   │   ├── contacts.py     # Contatos, chat e push notifications
│   │   │   │   ├── categories.py   # Categorias
│   │   │   │   ├── search.py       # Busca inteligente
│   │   │   │   ├── payments.py     # Pagamentos (Asaas)
│   │   │   │   ├── webhooks.py     # Webhooks Asaas
│   │   │   │   ├── support.py      # Tickets de suporte (SAC)
│   │   │   │   ├── ads.py          # Sistema de anúncios
│   │   │   │   ├── uploads.py      # Upload de mídia
│   │   │   │   ├── documents.py    # Documentos PDF
│   │   │   │   ├── contract_templates.py
│   │   │   │   ├── subscriptions.py
│   │   │   │   ├── admin_api.py    # API administrativa JSON
│   │   │   │   ├── professional_api.py
│   │   │   │   ├── attendant_auth.py
│   │   │   │   ├── turnstile.py
│   │   │   │   └── system_config_api.py
│   │   │   └── websockets/
│   │   │       ├── manager.py      # Gerenciador de conexões WS
│   │   │       └── routes.py       # Rotas WebSocket
│   │   ├── core/                   # Config, segurança, database
│   │   ├── crud/                   # Operações de banco de dados
│   │   ├── jobs/                   # Background jobs (cron)
│   │   │   └── expire_featured_projects.py
│   │   ├── models/                 # Modelos Pydantic
│   │   ├── schemas/                # Schemas de validação/resposta
│   │   ├── services/               # Integrações externas
│   │   │   ├── asaas.py            # Asaas (pagamentos)
│   │   │   └── geocoding.py        # Google Maps geocoding
│   │   └── utils/
│   │       ├── credit_pricing.py   # Lógica de créditos dinâmicos
│   │       ├── validators.py
│   │       └── timezone.py
│   ├── ads/                        # Conteúdo HTML/CSS/JS dos anúncios
│   ├── static/                     # Assets estáticos
│   ├── templates/                  # Templates Jinja2
│   ├── logs/                       # Logs de anúncios
│   ├── tests/                      # Testes automatizados
│   ├── requirements.txt
│   └── pytest.ini
├── mobile/
│   ├── src/
│   │   ├── api/                    # Cliente HTTP (axios)
│   │   ├── components/             # Componentes reutilizáveis
│   │   ├── screens/                # Telas da aplicação
│   │   ├── stores/                 # Estado Zustand
│   │   ├── services/               # Notificações push
│   │   ├── hooks/                  # Custom hooks
│   │   ├── theme/                  # Cores e tema Paper
│   │   ├── types/                  # Types TypeScript
│   │   └── utils/                  # Utilitários
│   ├── App.tsx                     # Entrada + navegação
│   └── package.json
└── docs/                           # Documentação técnica
    ├── implementation-plan.md
    ├── dynamic-credit-pricing.md
    ├── ads-routes.md
    ├── background-jobs.md
    ├── push-notifications-webhooks.md
    ├── mobile-testing.md
    └── API_REFERENCE.md
```

---

## 🔄 Fluxo da Aplicação

### Fluxo do Cliente

```
Cadastro / Login
      │
      ▼
Completar Perfil (CPF, telefone, endereço)
      │
      ▼
Seleção de Papel (cliente / profissional)
      │
      ▼
Tela de Anúncio (AdScreen — publi_screen_client)
      │
      ▼
Home do Cliente (WelcomeCustomerScreen)
  ├── Banner de anúncio (banner_client_home)
  ├── Busca de categorias/subcategorias (com sugestões em tempo real)
  ├── Grade de categorias (CategoryGrid)
  └── Carrossel "Meus Projetos" (MyProjectsCarousel)
        │
        ▼
  Criar Projeto (CreateProjectScreen)
    • Título (máx 80 caracteres)
    • Descrição
    • Categoria + Subcategoria
    • Orçamento mínimo / máximo
    • Localização (mapa + geocoding automático)
    • Opção de execução remota
        │
        ▼
  Detalhe do Projeto — visão cliente (ProjectClientDetailScreen)
    • Editar projeto (EditProjectScreen)
    • Lista de profissionais que contataram (ProjectContactsList)
    • Marcar como concluído + Avaliar profissional (EvaluationModal)
        │
        ▼
  Chat com Profissional (ContactDetailScreen)
    • Mensagens em tempo real (WebSocket / REST)
    • Marcação automática de mensagens como lidas
```

### Fluxo do Profissional

```
Login / Cadastro
      │
      ▼
Completar Perfil + Seleção de Papel
      │
      ▼
Tela de Anúncio (AdScreen — publi_screen_professional)
      │
      ▼
Home do Profissional (WelcomeProfessionalScreen)
  ├── Banner de anúncio (banner_professional_home)
  ├── Card de estatísticas (ProfessionalStatsCard)
  ├── Resumo de projetos próximos (NearbySummary)
  └── Avatar com localização (LocationAvatar)
        │
        ├── Lista de Projetos Próximos (ProjectsListScreen)
        │     • Filtro: todos / apenas presenciais
        │     • Ordenação: data, destaque, urgência
        │     • Badges: 🆕 novo · ⭐ destacado · ⏰ expirando
        │
        ├── Detalhe do Projeto — visão profissional (ProjectProfessionalsDetailScreen)
        │     • Preview de custo em créditos antes de contatar
        │     • Modal de confirmação (ConfirmContactModal)
        │     • Proposta com mensagem e valor estimado
        │
        ├── Projetos Contatados (ContactedProjectsScreen)
        │
        ├── Chat com Cliente (ContactDetailScreen)
        │
        ├── Minhas Avaliações (ProfileEvaluationsScreen)
        │
        └── Editar Categorias de Atuação (EditProfessionalSettingsScreen)
```

### Fluxo de Autenticação

```
LoginScreen
  ├── E-mail + Senha (com Cloudflare Turnstile anti-bot)
  └── Google Sign-In (GSI nativo)
        │
        ▼
  Verificar perfil completo
  ├── Incompleto → CompleteProfileScreen (CPF, telefone, endereço)
  └── Completo   → ProfileSelectionScreen (escolher papel ativo)
        │
        ▼
  AdScreen → Home (cliente ou profissional)
```

---

## ✅ Funcionalidades Implementadas

### 1. Autenticação & Perfis

- Login com e-mail/senha protegido por **Cloudflare Turnstile**
- Login com **Google** (GSI — Google Sign-In nativo)
- **Bypass automático** do Turnstile para re-login com token válido
- Seleção de papel ativo (cliente / profissional) por sessão
- Fluxo de **complete-profile** com CPF, telefone e endereço geocodificado
- Bloqueio de alteração de CPF após cadastro
- Refresh token e logout

### 2. Projetos

- Criação com título (máx 80 chars), descrição, categoria/subcategoria, orçamento, localização e flag de execução remota
- Geocoding automático via Google Maps ao digitar endereço
- Seleção de localização por mapa interativo (MapPinPicker)
- Edição de projeto
- Listagem com filtros: categoria, subcategorias, status, orçamento, geolocalização
- **Ordenação:** por data de criação, por destaque (`is_featured`), por urgência (`deadline`)
- **Badges dinâmicos:**
  - 🆕 `new` — projeto criado há < 24h
  - ⭐ `featured` — destaque ativo e dentro da validade
  - ⏰ `expiring_soon` — destaque expira em < 24h
- Busca de projetos próximos (`/projects/nearby/combined`) com fallback para configurações salvas do profissional
- Filtro presencial vs remoto (`remote_execution`)
- Fechamento de projeto pelo cliente (`/projects/{id}/close`)
- Avaliação do profissional pelo cliente — 1 a 5 estrelas + comentário (`/projects/{id}/evaluate`)
- Atualização automática do `average_rating` do profissional (média truncada com exclusão de 10% dos outliers se ≥ 20 avaliações)

### 3. Sistema de Créditos Dinâmico ⭐

Precificação inteligente baseada na **idade do projeto** e no **histórico de contatos**:

| Situação | Créditos | Código de razão |
|----------|----------|-----------------|
| Projeto novo — 0 a 24h sem contatos | **3** | `new_project_0_24h` |
| Projeto recente — 24 a 36h sem contatos | **2** | `new_project_24_36h` |
| Projeto antigo — 36h+ sem contatos | **1** | `new_project_36h_plus` |
| Com contatos — até 24h após 1º contato | **2** | `contacted_project_0_24h_after_first` |
| Com contatos — 24h+ após 1º contato | **1** | `contacted_project_24h_plus_after_first` |

**Mecanismos técnicos:**
- Locking atômico via MongoDB `find_one_and_update` (evita race conditions)
- Endpoint de preview de custo antes de confirmar (`GET /contacts/{project_id}/cost-preview`)
- Registro de cada transação na coleção `credit_transactions` para auditoria completa

📖 [Documentação completa](docs/dynamic-credit-pricing.md)

### 4. Contatos (Leads)

- Profissional envia proposta (mensagem + valor estimado) consumindo créditos
- Validação de papel e saldo antes da criação
- Notificação push ao cliente ao receber novo lead
- Lista de contatos do projeto para o cliente (`GET /projects/{project_id}/contacts`)
- Status do contato: `pending` → `in_conversation` → `accepted` / `rejected` / `completed`
- Mudança automática para `in_conversation` ao enviar a primeira mensagem

### 5. Chat em Tempo Real + Push Notifications Android

- **WebSocket** (`/ws/{user_id}?token=<JWT>`) para mensagens instantâneas
- **REST API** completa para contatos e chat:
  - `GET /contacts/history` — histórico de contatos do usuário
  - `GET /contacts/{contact_id}` — detalhe de um contato com mensagens
  - `POST /contacts/{contact_id}/messages` — enviar mensagem via REST (fallback ao WebSocket)
  - `POST /contacts/{contact_id}/messages/mark-read` — marcar mensagens como lidas
- **Push notifications bidirecionais** (cliente ↔ profissional) via Firebase Cloud Messaging (FCM):
  - Disparo automático ao outro participante quando nova mensagem é recebida via WebSocket
  - Disparo automático ao destinatário quando mensagem é enviada via REST
  - Configuração de canal `messages` Android (alta prioridade, vibração e som)
  - Usuário offline recebe notificação; ao tocar, abre o chat correspondente
- Marcação automática de mensagens como lidas ao abrir o chat
- Mudança de status `pending` → `in_conversation` na primeira mensagem
- Chat global acessível via `ChatModal` (componente sobreposto em qualquer tela)

### 6. Avaliações e Ranking

- Profissional visualiza suas avaliações na tela **Minhas Avaliações** (estrelas, comentário, data)
- `GET /users/me/evaluations` retorna avaliações do usuário autenticado
- Ranking recalculado automaticamente a cada avaliação

### 7. Projetos Destacados (Pagos)

- Destaque via Asaas: opções de 7, 15 ou 30 dias
- Pagamento por **PIX** ou **Cartão de Crédito**
- Campos no projeto: `is_featured`, `featured_until`, `featured_purchased_at`, `featured_payment_id`
- Background job automático remove o destaque após expirar

📖 [Documentação de background jobs](docs/background-jobs.md)

### 8. Créditos, Pacotes e Assinaturas

- Listagem de pacotes de créditos disponíveis (`GET /api/payments/credit-packages`)
- Listagem de planos de assinatura (`GET /api/payments/plans`)
- Compra via Asaas (PIX/cartão) com QR Code PIX retornado
- Webhooks Asaas para confirmação automática de pagamentos
- Histórico de transações de crédito por usuário

### 9. Sistema de Anúncios

**4 slots fixos:**

| Slot | Onde aparece |
|------|-------------|
| `publi_screen_client` | Tela cheia — home do cliente |
| `publi_screen_professional` | Tela cheia — home do profissional |
| `banner_client_home` | Banner — home do cliente |
| `banner_professional_home` | Banner — home do profissional |

- Upload de conteúdo HTML/CSS/JS ou imagem via painel admin
- Validação de proporção para banners (mín. 2,5:1; ideal 3:1)
- Cache local no mobile para exibição offline
- **Tracking real:**
  - Impressões: `POST /system-admin/api/public/ads/impression/{ad_type}`
  - Cliques: `POST /system-admin/api/public/ads/click/{ad_type}`
  - Logs em `logs/ad_impressions.log` e `logs/ad_clicks.log`

📖 [Documentação de rotas de ads](docs/ads-routes.md)

### 10. Busca Inteligente

- Sugestões em tempo real enquanto o usuário digita (`GET /search/suggestions?q=...`)
- Busca por nome de categoria, nome de subcategoria e tags
- Ordenação por relevância: match exato > match parcial > tag
- Endpoint `/categories/search` para busca completa

### 11. Suporte via Tickets (SAC)

- Criação de ticket pelo cliente/profissional (`POST /support/tickets`)
- Chat por ticket em tempo real (WebSocket)
- Atribuição de atendentes a tickets
- Atualização de status (aberto, em andamento, resolvido)
- Rating pós-atendimento

### 12. Upload e Documentos

- Upload de imagens, vídeos e áudio (`/uploads`)
- Upload e validação de documentos PDF com assinaturas digitais (`/documents`)
- Templates de contratos (`/contract-templates`)

### 13. Painel Administrativo

- Interface HTML completa em `/system-admin`
- API JSON administrativa (`/api/admin`) para gerenciar usuários, projetos, contatos, assinaturas
- Configuração do sistema via `/api/admin/system-config`
- Gerenciamento de anúncios via `/ads-admin`

### 14. Painel do Profissional

- Dashboard com estatísticas em `/professional`
- Mapa de projetos com geolocalização
- Gerenciamento de perfil e configurações de atuação

---

## 🌐 API — Endpoints Principais

> Documentação interativa completa disponível em `/docs` (Swagger UI) e `/redoc`.

### Autenticação (`/auth`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/register` | Cadastrar novo usuário |
| POST | `/auth/login` | Login (e-mail + senha + Turnstile) |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/google-login` | Login via Google |
| GET | `/auth/turnstile-verify` | Verificar token Turnstile |

### Usuários (`/users`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users/me` | Perfil do usuário autenticado |
| PUT | `/users/me` | Atualizar perfil |
| GET | `/users/me/evaluations` | Avaliações recebidas |
| GET | `/users/professionals/nearby` | Profissionais próximos |
| POST | `/users/me/fcm-token` | Registrar token FCM |
| PUT | `/users/me/professional-settings` | Atualizar configurações do profissional |

### Projetos (`/projects`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/projects/` | Criar projeto |
| GET | `/projects/` | Listar projetos com filtros |
| GET | `/projects/nearby/combined` | Projetos próximos (todos + presenciais) |
| GET | `/projects/{id}` | Detalhe do projeto |
| PUT | `/projects/{id}` | Editar projeto |
| DELETE | `/projects/{id}` | Excluir projeto |
| POST | `/projects/{id}/close` | Fechar projeto |
| POST | `/projects/{id}/evaluate` | Avaliar profissional |
| GET | `/projects/{id}/contacts` | Listar contatos do projeto (cliente) |

### Contatos e Chat

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/projects/{project_id}/contacts` | Criar contato / enviar proposta |
| GET | `/projects/{project_id}/contact-cost-preview` | Preview de custo em créditos |
| GET | `/projects/{project_id}/contacts` | Listar contatos do projeto (cliente) |
| GET | `/contacts/history` | Histórico de contatos do usuário autenticado |
| GET | `/contacts/{contact_id}` | Detalhe de um contato com mensagens |
| POST | `/contacts/{contact_id}/messages` | Enviar mensagem (REST — fallback ao WebSocket) |
| POST | `/contacts/{contact_id}/messages/mark-read` | Marcar mensagens como lidas |

### Pagamentos (`/api/payments`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/payments/plans` | Planos de assinatura |
| GET | `/api/payments/credit-packages` | Pacotes de créditos |
| GET | `/api/payments/featured-pricing` | Preços para destaque |
| POST | `/api/payments/subscription` | Contratar assinatura |
| POST | `/api/payments/credit-package` | Comprar créditos |
| POST | `/api/payments/featured-project` | Destacar projeto |

### Busca e Categorias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/search/suggestions` | Sugestões em tempo real |
| GET | `/categories` | Listar categorias |
| GET | `/categories/search` | Buscar categorias |

### Anúncios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/system-admin/api/public/ads/{ad_type}` | Obter anúncio (mobile) |
| POST | `/system-admin/api/public/ads/impression/{ad_type}` | Registrar impressão |
| POST | `/system-admin/api/public/ads/click/{ad_type}` | Registrar clique |

### WebSocket

```
ws://<host>/ws/{user_id}?token=<JWT>
```

Tipos de mensagem suportados:

| Tipo | Direção | Descrição |
|------|---------|-----------|
| `subscribe_projects` | cliente → servidor | Inscrever em atualizações de projetos |
| `new_message` | bidirecional | Enviar/receber mensagem de chat + push FCM ao destinatário |
| `contact_update` | servidor → cliente | Atualização de status de contato |

---

## 📱 Telas do App Mobile

| Tela | Papel | Descrição |
|------|-------|-----------|
| `LoginScreen` | Todos | Login e-mail/senha ou Google |
| `SignUpScreen` | Todos | Cadastro de conta |
| `CompleteProfileScreen` | Todos | Completar CPF, telefone, endereço |
| `ProfileSelectionScreen` | Todos | Escolher papel ativo (cliente/profissional) |
| `AdScreen` | Todos | Tela cheia de anúncio antes da home |
| `WelcomeCustomerScreen` | Cliente | Home do cliente — busca, categorias, projetos |
| `CreateProjectScreen` | Cliente | Criar projeto com mapa e geocoding |
| `EditProjectScreen` | Cliente | Editar projeto existente |
| `ProjectClientDetailScreen` | Cliente | Detalhe do projeto + lista de contatos recebidos |
| `SearchResultsScreen` | Cliente | Resultados de busca de categorias |
| `AllProjectsScreen` | Cliente | Todos os projetos do cliente |
| `WelcomeProfessionalScreen` | Profissional | Home — estatísticas, projetos próximos |
| `ProjectsListScreen` | Profissional | Lista de projetos filtráveis |
| `ProjectProfessionalsDetailScreen` | Profissional | Detalhe do projeto + proposta + custo em créditos |
| `ContactedProjectsScreen` | Profissional | Projetos que o profissional já contatou |
| `EditProfessionalSettingsScreen` | Profissional | Configurar categorias e raio de atuação |
| `ProfileEvaluationsScreen` | Profissional | Avaliações recebidas (estrelas + comentário) |
| `ContactDetailScreen` | Ambos | Chat com mensagens + marcação de leitura |

---

## 🧩 Componentes Reutilizáveis

| Componente | Descrição |
|-----------|-----------|
| `BannerAd` | Exibe banner de anúncio com cache local |
| `PubliScreenAd` | Tela cheia de anúncio HTML/CSS/JS |
| `ChatModal` | Modal global de chat (sobrepõe qualquer tela) |
| `ConfirmContactModal` | Modal de confirmação de contato (exibe custo em créditos) |
| `EvaluationModal` | Modal de avaliação 1–5 estrelas + comentário |
| `ProjectCard` | Card de projeto na listagem |
| `ProjectContactsList` | Lista de profissionais que contataram um projeto |
| `ProjectContatedCard` | Card de projeto já contatado pelo profissional |
| `CategoryGrid` | Grade de categorias para seleção |
| `MyProjectsCarousel` | Carrossel horizontal dos projetos do cliente |
| `ProfessionalStatsCard` | Card de estatísticas do profissional |
| `NearbySummary` | Resumo de projetos próximos |
| `LocationAvatar` | Avatar com indicador de localização |
| `MapPinPicker` | Picker de localização em mapa interativo |
| `AddressAutocomplete` | Autocomplete de endereço via Google Maps |
| `AddressSearch` | Busca de endereço simples |
| `EditAddressModal` | Modal para editar endereço |
| `ImageAdCarousel` | Carrossel de imagens de anúncio |
| `DynamicIcon` | Ícone dinâmico por nome (Material Icons) |
| `SocialButton` | Botão de ação social (Google, etc.) |

---

## 🧪 Testes Automatizados

### Backend

```bash
cd backend

# Instalar dependências
pip install -r requirements.txt

# Rodar todos os testes
pytest

# Testes específicos com saída detalhada
pytest tests/test_dynamic_credit_pricing.py -v

# Com cobertura de código
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

### Suites de Testes Existentes

| Arquivo | Descrição |
|---------|-----------|
| `test_dynamic_credit_pricing.py` | 9 cenários de precificação dinâmica de créditos |
| `test_admin_grant.py` | Concessão de permissões admin |
| `test_auth_complete_profile.py` | Fluxo de complete-profile |
| `test_contacted_projects.py` | Projetos contatados pelo profissional |
| `test_contacts_integration.py` | Integração de contatos |
| `test_complete_service_flow.py` | Fluxo completo cliente → profissional |
| `test_e2e_flows.py` | Testes end-to-end |
| `test_full_workflow_integration.py` | Integração do workflow completo |
| `test_projects_filters.py` | Filtros de listagem de projetos |
| `test_projects_geocode.py` | Geocoding automático |
| `test_transactions.py` | Transações de crédito |
| `test_professional_stats.py` | Estatísticas do profissional |
| `test_user_stats.py` | Estatísticas do usuário |
| `test_project_title_length.py` | Validação de título (máx 80 chars) |
| `test_firebase_user.py` | Usuário Firebase |
| `test_material_icons.py` | Validação de ícones |

**Cobertura:** ~50% (configurado em `pytest.ini`)

### Mobile (Jest)

```bash
cd mobile
npm test
```

---

## 🔧 Configuração

### Backend

**1. Instalar dependências:**
```bash
cd backend
pip install -r requirements.txt
```

**2. Configurar variáveis de ambiente (`.env`):**
```env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=agapp

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://...

# Cloudflare Turnstile (anti-bot)
# TURNSTILE_SECRET_KEY é confidencial — usado apenas no backend para verificação
TURNSTILE_SECRET_KEY=your-turnstile-secret
# TURNSTILE_SITE_KEY é público — usado no frontend/WebView para renderizar o widget
TURNSTILE_SITE_KEY=your-turnstile-site-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Asaas Payments
ASAAS_API_KEY=your-asaas-api-key
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3

# Google Maps (Geocoding)
GOOGLE_MAPS_API_KEY=your-google-maps-key

# CORS
CORS_ORIGINS=["http://localhost:3000","https://agilizapro.cloud"]
```

**3. Iniciar servidor:**
```bash
uvicorn app.main:app --reload
```

### Mobile

**1. Instalar dependências:**
```bash
cd mobile
npm install
```

**2. Configurar variáveis (`.env`):**
```env
API_URL=http://localhost:8000
```

**3. Rodar no emulador:**
```bash
# Android
expo run:android

# iOS
expo run:ios
```

---

## 📊 Background Jobs

### Expiração de Projetos Destacados

Remove o status de destaque (`is_featured = false`) dos projetos cujo prazo (`featured_until`) já passou.

**Execução manual:**
```bash
cd backend
python -m app.jobs.expire_featured_projects
```

**Cron (recomendado — executar a cada hora):**
```cron
0 * * * * cd /path/to/backend && python -m app.jobs.expire_featured_projects
```

📖 [Documentação completa de jobs](docs/background-jobs.md)

---

## 🔒 Segurança

| Mecanismo | Status |
|-----------|--------|
| JWT com expiração | ✅ |
| Cloudflare Turnstile (anti-bot no login/cadastro) | ✅ |
| Google OAuth | ✅ |
| Rate limiting — SlowAPI (100 req/min por IP) | ✅ |
| Locking atômico para dedução de créditos | ✅ |
| Validação de entrada — Pydantic | ✅ |
| CORS configurado por variável de ambiente | ✅ |
| Senhas hasheadas com bcrypt | ✅ |
| Tokens armazenados em secure storage (mobile) | ✅ |
| HTTPS obrigatório em produção | ✅ |
| Bloqueio de alteração de CPF após cadastro | ✅ |
| Autorização por recurso (apenas dono acessa seus dados) | ✅ |

---

## 📈 Monitoramento e Logs

### Logs Disponíveis

| Arquivo | Conteúdo |
|---------|----------|
| `logs/ad_clicks.log` | Cliques em anúncios (JSON com timestamp) |
| `logs/ad_impressions.log` | Impressões de anúncios (JSON com timestamp) |
| stdout | Logs gerais da aplicação |

### Métricas Recomendadas

- Taxa de conversão: leads → contratos fechados
- CTR de anúncios por slot
- Distribuição de preços de créditos pagos (1 / 2 / 3)
- Tempo médio de resposta de profissionais a novos leads
- Taxa de conclusão de projetos
- Erros de crédito insuficiente (tentativas falhas de contato)

---

## 🚀 Deploy

### Backend (Docker)

```bash
# Build e execução
docker build -t agapp-backend .
docker run -p 8000:8000 --env-file .env agapp-backend

# Ou com docker-compose
docker-compose up -d
```

O `Dockerfile` e `docker-compose.yml` estão na raiz do repositório.

### Mobile (EAS Build)

```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

---

## 📖 Documentação Adicional

| Documento | Descrição |
|-----------|-----------|
| [Plano de Implementação](docs/implementation-plan.md) | Roadmap completo com backlog |
| [Precificação Dinâmica](docs/dynamic-credit-pricing.md) | Regras e arquitetura do sistema de créditos |
| [Rotas de Anúncios](docs/ads-routes.md) | API completa de anúncios |
| [Background Jobs](docs/background-jobs.md) | Jobs automáticos e configuração de cron |
| [Push Notifications](docs/push-notifications-webhooks.md) | Configuração FCM e webhooks Asaas |
| [Testes Mobile](docs/mobile-testing.md) | Guia de testes no app |
| [Referência de API](docs/API_REFERENCE.md) | Referência completa de todos os endpoints |

---

## 🗺️ Roadmap

### 🚧 Em Desenvolvimento

- [ ] Mobile: Tela de conclusão de projeto (seleção do profissional vencedor + valor final)
- [ ] Mobile: Modal de avaliação integrado ao fechamento
- [ ] Mobile: Tela "Meus Créditos" (saldo + histórico de transações)
- [ ] Mobile: Loja de pacotes de créditos com QR Code PIX
- [ ] Mobile: Tela de assinaturas (contratar, cancelar, status)
- [ ] Mobile: Tela de suporte (listar tickets, abrir novo, chat com atendente)
- [ ] Mobile: CTA "Destacar projeto" em criar/editar/detalhe
- [ ] Mobile: Badge de mensagens não lidas na navegação
- [ ] Backend: Dashboard admin com analytics de conversão
- [ ] Backend: Relatórios de impressões/cliques de ads no admin
- [ ] Backend: Registro de `lead_events` (timestamps de criação → contato → chat → conclusão)
- [ ] Backend: Badges/níveis de reputação para profissionais
- [ ] Backend: Middleware de log para endpoints críticos (auth, pagamentos, contatos)
- [ ] Backend: Exportação de logs para S3
- [ ] Backend: Silent refresh / logout automático quando token expirar

### ✅ Recentemente Implementado

- [x] **Push notifications Android para chat** — notificação FCM ao destinatário ao enviar mensagem via WebSocket ou REST
- [x] **Canal Android `messages`** — alta prioridade, vibração e som configurados via `expo-notifications`
- [x] **REST API completa de contatos** — `GET /contacts/history`, `GET /contacts/{id}`, `POST /contacts/{id}/messages`, `POST /contacts/{id}/messages/mark-read`

---

## 📄 Licença

Proprietário — Todos os direitos reservados.

## 💬 Suporte Técnico

Para dúvidas, consulte a documentação em `/docs` ou abra uma issue no repositório.
