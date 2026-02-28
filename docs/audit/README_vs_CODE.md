# Auditoria: README vs Código — AgApp (branch `master`)

> **Data da auditoria:** 2026-02-28  
> **Branch auditado:** `master`  
> **Auditor:** Copilot Coding Agent  

---

## Sumário Executivo

O `README.md` da raiz descreve uma plataforma madura com backend FastAPI + app Expo cobrindo autenticação, projetos, créditos, chat, pagamentos Asaas, push FCM, anúncios, SAC e painéis admin/profissional. A maior parte das funcionalidades **está implementada** no `master`, porém existem **quatro gaps críticos** que quebram fluxos de produção:

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `POST /users/me/fcm-token` — rota **não exposta** (função existe sem `@router.post`) | Registro de push notifications falha silenciosamente |
| 2 | `/contacts/history` — campo `unread_count` **não calculado** pelo backend | Polling de mensagens não lidas sempre retorna 0 |
| 3 | `ChatListScreen` — tela de lista de conversas **ausente** no mobile | Usuários não têm como navegar entre conversas |
| 4 | **Idempotency key** para criação de contato — **não implementado** no master | Profissional pode perder múltiplos créditos em clique duplo |

Os PRs #34 e #36 (ambos abertos) propõem correções para os gaps 2, 3 e 4. O PR #37 está vazio.

---

## Metodologia

A auditoria comparou:
- Rotas registradas via decoradores `@router.*` nos arquivos `backend/app/api/endpoints/*.py`
- Telas em `mobile/src/screens/` e componentes em `mobile/src/components/`
- APIs chamadas em `mobile/src/api/*.ts`
- Estrutura de navegação em `mobile/App.tsx`
- Jobs em `backend/app/jobs/`
- Referências cruzadas de campos entre frontend e backend

---

## 1. Autenticação & Perfis

**Promessa (README):** Login e-mail/senha + Turnstile, Google Sign-In, complete-profile, refresh token, seleção de papel, bloqueio de CPF.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /auth/register` | `endpoints/auth.py:18` | ✅ OK | — |
| `POST /auth/login` | `endpoints/auth.py:38` | ✅ OK | — |
| `POST /auth/login-with-turnstile` | `endpoints/auth.py:86` | ✅ OK | README lista `/auth/login` como único endpoint, mas a rota com Turnstile é `/auth/login-with-turnstile` |
| `POST /auth/refresh` | `endpoints/auth.py:105` | ✅ OK | — |
| `POST /auth/google` | `endpoints/auth.py:111` | ✅ OK | README documenta como `/auth/google-login` — nome diverge |
| `GET /auth/turnstile-site-key` | `endpoints/auth.py:174` | ⚠️ Parcial | README documenta como `GET /auth/turnstile-verify` — nome incorreto |
| `PUT /auth/complete-profile` | `endpoints/auth.py:189` | ✅ OK | — |
| Bloqueio de CPF após cadastro | `endpoints/auth.py` (validação) | ✅ OK | — |
| Seleção de papel ativo (cliente/profissional) | `mobile/src/screens/ProfileSelectionScreen.tsx` + `authStore` | ✅ OK | — |
| Silent refresh / logout automático | `mobile/src/api/axiosClient.ts` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado. Mismatch menor nos nomes de endpoints documentados.

---

## 2. Projetos

**Promessa (README):** CRUD completo, geocoding, mapa interativo, filtros, badges dinâmicos, close, avaliação, projetos próximos.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /projects/` | `endpoints/projects.py:55` | ✅ OK | — |
| `GET /projects/` com filtros | `endpoints/projects.py:108` | ✅ OK | — |
| `GET /projects/nearby/combined` | `endpoints/projects.py:221` | ✅ OK | — |
| `GET /projects/{id}` | `endpoints/projects.py:414` | ✅ OK | — |
| `PUT /projects/{id}` | `endpoints/projects.py:634` | ✅ OK | — |
| `DELETE /projects/{id}` | `endpoints/projects.py:694` | ✅ OK | — |
| `POST /projects/{id}/close` | `endpoints/projects.py:723` | ✅ OK | — |
| `POST /projects/{id}/evaluate` | `endpoints/projects.py:780` | ✅ OK | — |
| `GET /projects/{id}/contacts` | `endpoints/projects.py:589` | ✅ OK | Campo `unread_count` calculado por loop Python |
| Badges `new`, `featured`, `expiring_soon` | `endpoints/projects.py` (lógica inline) | ✅ OK | — |
| Geocoding automático | `services/geocoding.py` + `endpoints/users.py:86` | ✅ OK | — |
| MapPinPicker (mobile) | `mobile/src/components/MapPinPicker.tsx` | ✅ OK | — |
| Background job expiração de destaque | `jobs/expire_featured_projects.py` | ✅ OK | Cron não configurado automaticamente — requer setup manual |
| Filtro subcategorias em `/nearby/combined` | `endpoints/projects.py:277-282` | ⚠️ Parcial | Filtra subcategorias salvas do profissional quando nenhuma é passada, mas o comportamento não é testado de ponta-a-ponta com o mobile |

**Conclusão do domínio:** ✅ Implementado. Subcategory filtering no `/nearby/combined` existe mas o comportamento de fallback (carregar configurações salvas do profissional automaticamente no login) ainda está pendente nos PRs #34/#36.

---

## 3. Sistema de Créditos Dinâmico

**Promessa (README):** 5 faixas de preço por idade/histórico do projeto, locking atômico, preview de custo, `credit_transactions`.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| Lógica de precificação dinâmica | `utils/credit_pricing.py` | ✅ OK | — |
| Locking atômico (`find_one_and_update`) | `endpoints/projects.py:489` (criação de contato) | ✅ OK | — |
| `GET /projects/{id}/contact-cost-preview` | `endpoints/projects.py:448` | ✅ OK | — |
| Registro em `credit_transactions` | `endpoints/projects.py` (criação de contato) | ✅ OK | — |
| Tela CreditsScreen (mobile) | `mobile/src/screens/CreditsScreen.tsx` | ✅ OK | — |
| Tela CreditPackagesScreen (mobile) | `mobile/src/screens/CreditPackagesScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Totalmente implementado conforme descrito.

---

## 4. Contatos (Leads)

**Promessa (README):** Profissional cria proposta consumindo créditos, validação, notificação push, lista de contatos do projeto, ciclo de status.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /projects/{id}/contacts` (criar contato) | `endpoints/projects.py:489` | ✅ OK | — |
| Validação de saldo e papel | `endpoints/projects.py:489` | ✅ OK | — |
| Notificação push ao cliente ao receber lead | `endpoints/projects.py` → `firebase.send_multicast_notification` | ✅ OK | — |
| `GET /projects/{id}/contacts` (lista para cliente) | `endpoints/projects.py:589` | ✅ OK | — |
| Status `pending` → `in_conversation` na 1ª mensagem | `utils/contact_helpers.py` + `websockets/routes.py` + `contacts.py` | ✅ OK | — |
| **Idempotency key** (header `X-Idempotency-Key`) | — | ❌ Falta | Não implementado no master. PRs #34 e #36 propõem isso. Sem proteção, clique duplo deduz créditos duplicados |

**Conclusão do domínio:** ⚠️ Parcial. Fluxo principal funciona, mas falta a proteção de idempotência.

---

## 5. Chat em Tempo Real + Push Notifications

**Promessa (README):** WebSocket + REST API completa para contatos/chat, push bidirecional, marcação de lidas, ChatModal global, badge de não lidas.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| WebSocket `/ws/{user_id}?token=JWT` | `api/websockets/routes.py` | ✅ OK | — |
| `GET /contacts/history` | `endpoints/contacts.py:14` | ⚠️ Parcial | Retorna lista de contatos MAS **não calcula `unread_count`** — campo ausente na resposta |
| `GET /contacts/{id}` | `endpoints/contacts.py:30` | ✅ OK | — |
| `POST /contacts/{id}/messages` | `endpoints/contacts.py:49` | ✅ OK | — |
| `POST /contacts/{id}/messages/mark-read` | `endpoints/contacts.py:146` | ✅ OK | — |
| Push FCM via WebSocket | `api/websockets/routes.py:115-129` | ✅ OK | — |
| Push FCM via REST | `endpoints/contacts.py:120-145` | ✅ OK | — |
| Canal Android `messages` | `mobile/src/services/notifications.ts` | ✅ OK | — |
| `ChatModal` global (mobile) | `mobile/src/components/ChatModal.tsx` + `App.tsx` | ✅ OK | — |
| **Polling de não lidas (60s)** | `App.tsx:123-141` | ⚠️ Parcial | Polling existe e chama `/contacts/history`, mas `unread_count` não é calculado pelo backend → sempre 0 |
| Badge de não lidas no `LocationAvatar` | `mobile/src/components/LocationAvatar.tsx:24` + `notificationStore` | ⚠️ Parcial | Badge exibido, mas valor sempre 0 pela razão acima |
| **`ChatListScreen`** (tela de lista de chats) | — | ❌ Falta | Não existe em `mobile/src/screens/`. PRs #34 e #36 propõem. Usuário não tem tela para navegar entre conversas |
| `ContactDetailScreen` (chat individual) | `mobile/src/screens/ContactDetailScreen.tsx` | ✅ OK | — |
| `ProjectContactsList` (lista de contatos de um projeto) | `mobile/src/components/ProjectContactsList.tsx` | ✅ OK | — |
| Registro de `push token` via `POST /users/me/fcm-token` | — | ❌ Falta | Função `register_fcm_token` definida em `endpoints/users.py:206` **sem decorador `@router.post`** → rota não exposta → push registration falha silenciosamente |

**Conclusão do domínio:** ⚠️ Parcial. Infraestrutura de WebSocket e REST está pronta. Três itens críticos quebram o fluxo completo: `unread_count` não calculado, `ChatListScreen` ausente e endpoint FCM não exposto.

---

## 6. Avaliações e Ranking de Reputação

**Promessa (README):** Avaliações 1-5 estrelas, `GET /users/me/evaluations`, atualização de `average_rating`, níveis de reputação (Iniciante → Diamante).

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /projects/{id}/evaluate` | `endpoints/projects.py:780` | ✅ OK | — |
| Recálculo de `average_rating` | `endpoints/projects.py` (pós-avaliação) | ✅ OK | — |
| `GET /users/me/evaluations` | `endpoints/users.py:19` | ✅ OK | — |
| `GET /users/me/reputation` | `endpoints/users.py:435` | ✅ OK | — |
| `GET /users/professionals/{id}/reputation` | `endpoints/users.py:415` | ✅ OK | — |
| `ProfileEvaluationsScreen` (mobile) | `mobile/src/screens/ProfileEvaluationsScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Totalmente implementado.

---

## 7. Projetos Destacados (Pagos)

**Promessa (README):** Destaque via Asaas (7/15/30 dias), PIX/Cartão, campos no modelo, background job de expiração.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /api/payments/featured-project` | `endpoints/payments.py:318` | ✅ OK | — |
| `GET /api/payments/featured-pricing` | `endpoints/payments.py:69` | ✅ OK | — |
| Campos `is_featured`, `featured_until`, etc. | `models/project.py` (inferido pela lógica) | ✅ OK | — |
| Background job de expiração | `jobs/expire_featured_projects.py` | ✅ OK | Requer cron externo |
| CTA "Destacar Projeto" (mobile) | `mobile/src/screens/ProjectClientDetailScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 8. Créditos, Pacotes e Assinaturas

**Promessa (README):** Pacotes de crédito, planos de assinatura, compra via Asaas, webhooks, histórico.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `GET /api/payments/plans` | `endpoints/payments.py:53` | ✅ OK | — |
| `GET /api/payments/credit-packages` | `endpoints/payments.py:61` | ✅ OK | — |
| `POST /api/payments/subscription` | `endpoints/payments.py:79` | ✅ OK | — |
| `GET /api/payments/subscription/status` | `endpoints/payments.py:180` | ✅ OK | — |
| `POST /api/payments/subscription/cancel` | `endpoints/payments.py:206` | ✅ OK | — |
| `POST /api/payments/credits` | `endpoints/payments.py:246` | ✅ OK | — |
| `GET /api/payments/history` | `endpoints/payments.py:425` | ✅ OK | — |
| Webhooks Asaas | `endpoints/webhooks.py` | ✅ OK | — |
| `SubscriptionsScreen` (mobile) | `mobile/src/screens/SubscriptionsScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Totalmente implementado.

---

## 9. Sistema de Anúncios

**Promessa (README):** 4 slots fixos, upload HTML/CSS/JS ou imagem, tracking de impressões/cliques, cache no mobile.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `GET /system-admin/api/public/ads/{ad_type}` | `endpoints/ads.py` (mobile_router) | ✅ OK | — |
| `POST .../impression/{ad_type}` e `.../click/{ad_type}` | `endpoints/ads.py` | ✅ OK | — |
| Upload via painel admin | `api/admin.py` + templates | ✅ OK | — |
| `AdScreen` e `BannerAd` (mobile) | `mobile/src/screens/AdScreen.tsx` + `components/BannerAd.tsx` | ✅ OK | — |
| Logs em `logs/ad_impressions.log` e `logs/ad_clicks.log` | `endpoints/ads.py` (logging) | ✅ OK | Diretório `logs/` requer permissão de escrita no container |

**Conclusão do domínio:** ✅ Implementado.

---

## 10. Busca Inteligente

**Promessa (README):** Sugestões em tempo real, busca por nome/subcategoria/tags, ordenação por relevância.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `GET /search/suggestions` | `endpoints/search.py:10` | ✅ OK | — |
| `GET /categories/search` | `endpoints/categories.py:186` | ✅ OK | — |
| Ordenação por relevância | `endpoints/search.py` (lógica inline) | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 11. Suporte via Tickets (SAC)

**Promessa (README):** Criação de ticket, chat em tempo real por ticket, atribuição de atendentes, rating pós-atendimento.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /support/tickets` | `endpoints/support.py:28` | ✅ OK | — |
| `GET /support/tickets/my` | `endpoints/support.py:59` | ✅ OK | — |
| `POST /support/tickets/{id}/messages` | `endpoints/support.py:95` | ✅ OK | — |
| Chat em tempo real via WebSocket | `api/websockets/routes.py` (`support_message` type) | ✅ OK | — |
| Atribuição de atendente | `endpoints/support.py:256` | ✅ OK | — |
| Rating pós-atendimento | `endpoints/support.py:159` | ✅ OK | — |
| `SupportScreen` (mobile) | `mobile/src/screens/SupportScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 12. Upload e Documentos

**Promessa (README):** Upload de imagens/vídeos/áudio, PDFs com assinatura digital, templates de contratos.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| `POST /uploads/media` | `endpoints/uploads.py:16` | ✅ OK | — |
| `/documents` | `endpoints/documents.py` | ✅ OK | — |
| `/contract-templates` | `endpoints/contract_templates.py` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 13. Painel Administrativo

**Promessa (README):** Interface HTML + API JSON, analytics de conversão, relatórios de ads, exportação S3.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| Interface HTML `/system-admin` | `api/admin.py` + templates Jinja2 | ✅ OK | — |
| `GET /api/admin/analytics/conversion` | `endpoints/admin_api.py:513` | ✅ OK | — |
| `GET /api/admin/analytics/ads` | `endpoints/admin_api.py:601` | ✅ OK | — |
| `POST /api/admin/analytics/export-logs-s3` | `endpoints/admin_api.py:670` | ✅ OK | Requer variáveis AWS configuradas |
| Gerenciamento de usuários/projetos/assinaturas | `endpoints/admin_api.py` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 14. Painel do Profissional

**Promessa (README):** Dashboard `/professional`, mapa de projetos, gerenciamento de perfil.

| Claim | Arquivo/Rota | Status | O que falta |
|-------|-------------|--------|-------------|
| Dashboard HTML `/professional` | `api/professional.py` | ✅ OK | — |
| `GET /api/professional/stats` | `endpoints/professional_api.py` | ✅ OK | — |
| `WelcomeProfessionalScreen` (mobile) | `mobile/src/screens/WelcomeProfessionalScreen.tsx` | ✅ OK | — |
| `EditProfessionalSettingsScreen` (mobile) | `mobile/src/screens/EditProfessionalSettingsScreen.tsx` | ✅ OK | — |

**Conclusão do domínio:** ✅ Implementado.

---

## 15. Background Jobs

**Promessa (README):** Job de expiração de projetos destacados, exportação de logs para S3.

| Claim | Arquivo | Status | O que falta |
|-------|---------|--------|-------------|
| `expire_featured_projects.py` | `jobs/expire_featured_projects.py` | ✅ OK | Cron externo não configurado automaticamente |
| `export_logs_to_s3.py` | `jobs/export_logs_to_s3.py` | ✅ OK | Requer credenciais AWS |

**Conclusão do domínio:** ✅ Implementado. Cron requer configuração manual no ambiente de produção.

---

## 16. Segurança

**Promessa (README):** JWT, Turnstile, Google OAuth, rate limiting (SlowAPI), locking atômico, Pydantic, CORS, bcrypt, secure storage mobile, HTTPS, bloqueio de CPF, autorização por recurso.

| Mecanismo | Evidência | Status |
|-----------|-----------|--------|
| JWT com expiração | `core/security.py` | ✅ OK |
| Cloudflare Turnstile | `endpoints/turnstile.py` + `endpoints/auth.py` | ✅ OK |
| Google OAuth | `endpoints/auth.py:111` | ✅ OK |
| Rate limiting SlowAPI 100 req/min | `main.py:limiter` | ✅ OK |
| Locking atômico de créditos | `endpoints/projects.py` (`find_one_and_update`) | ✅ OK |
| Validação Pydantic | Todos os endpoints | ✅ OK |
| CORS via variável de ambiente | `main.py` | ✅ OK |
| Senhas bcrypt | `core/security.py` | ✅ OK |
| Secure storage mobile | `mobile/src/stores/authStore.ts` (via `expo-secure-store`) | ✅ OK |
| Logging de endpoints críticos | `core/logging_middleware.py` | ✅ OK |
| Autorização por recurso | Validação em cada endpoint | ✅ OK |

**Conclusão do domínio:** ✅ Todos os mecanismos descritos estão presentes.

---

## 17. Testes Automatizados

**Promessa (README):** 16 suites de testes backend, cobertura ~50%. Mobile com Jest.

| Claim | Evidência | Status |
|-------|-----------|--------|
| `test_dynamic_credit_pricing.py` | `backend/tests/test_dynamic_credit_pricing.py` | ✅ OK |
| `test_admin_grant.py` | `backend/tests/test_admin_grant.py` | ✅ OK |
| `test_auth_complete_profile.py` | `backend/tests/test_auth_complete_profile.py` | ✅ OK |
| `test_contacted_projects.py` | `backend/tests/test_contacted_projects.py` | ✅ OK |
| `test_contacts_integration.py` | `backend/tests/test_contacts_integration.py` | ✅ OK |
| `test_complete_service_flow.py` | `backend/tests/test_complete_service_flow.py` | ✅ OK |
| `test_e2e_flows.py` | `backend/tests/test_e2e_flows.py` | ✅ OK |
| `test_full_workflow_integration.py` | `backend/tests/test_full_workflow_integration.py` | ✅ OK |
| `test_projects_filters.py` | `backend/tests/test_projects_filters.py` | ✅ OK |
| `test_projects_geocode.py` | `backend/tests/test_projects_geocode.py` | ✅ OK |
| `test_transactions.py` | `backend/tests/test_transactions.py` | ✅ OK |
| `test_professional_stats.py` | `backend/tests/test_professional_stats.py` | ✅ OK |
| `test_user_stats.py` | `backend/tests/test_user_stats.py` | ✅ OK |
| `test_project_title_length.py` | `backend/tests/test_project_title_length.py` | ✅ OK |
| `test_firebase_user.py` | `backend/tests/test_firebase_user.py` | ✅ OK |
| `test_material_icons.py` | `backend/tests/test_material_icons.py` | ✅ OK |
| Testes mobile (Jest) | `mobile/__tests__/` + `mobile/src/__tests__/` | ✅ OK |
| Cobertura ~50% | Declarado em `pytest.ini` | ✅ OK (não verificado em execução) |

**Conclusão do domínio:** ✅ Todos os arquivos listados existem. Os testes não cobrem os gaps identificados (sem teste para `unread_count`, rota FCM ou idempotência).

---

## 18. Deploy

**Promessa (README):** Dockerfile, docker-compose.yml, EAS Build.

| Claim | Evidência | Status |
|-------|-----------|--------|
| `Dockerfile` | `Dockerfile` (raiz) | ✅ OK |
| `docker-compose.yml` | `docker-compose.yml` (raiz) | ✅ OK |
| `eas.json` | `mobile/eas.json` | ✅ OK |

**Conclusão do domínio:** ✅ Implementado.

---

## Impacto dos PRs Abertos

### PR #34 — "Fix duplicate credit deductions, add subcategory filtering, chat system"
- **Estado:** Aberto, não-draft, **não mesclado**
- **Propõe:** Idempotência no backend, `GET /contacts/history` com `unread_count`, `ChatListScreen`, melhorias no `LocationAvatar`, subcategorias no login
- **Status no master:** Nenhuma dessas mudanças está em master
- **Impacto:** Se mesclado, fecha gaps 2, 3 e 4 desta auditoria

### PR #36 — "Implement contacts API, chat UI, and subcategory filtering" (Draft)
- **Estado:** Draft aberto, **não mesclado**
- **Propõe:** Reimplementação das mudanças do PR #34 (após PR #35 ter sido mesclado com apenas o debounce de botão)
- **Status no master:** Nenhuma dessas mudanças está em master
- **Impacto:** Equivalente ao PR #34 — fecha os mesmos gaps. Precisa de revisão antes de merge

### PR #37 — "[WIP] Add new feature for user interactions" (Draft)
- **Estado:** Draft, 1 commit, praticamente vazio
- **Propõe:** Não documentado ("olá" como body)
- **Impacto:** Sem impacto. Pode ser fechado

---

## Checklist de MVP/Release — Prioridades

### 🔴 Crítico (bloqueia produção)

- [ ] **Expor `POST /users/me/fcm-token`**: Adicionar `@router.post("/me/fcm-token")` ao decorador de `register_fcm_token` em `backend/app/api/endpoints/users.py`. Sem isso, push notifications não funcionam (mobile chama a rota mas recebe 404/405).
- [ ] **Calcular `unread_count` em `GET /contacts/history`**: Adicionar agregação MongoDB que conta mensagens onde `sender_id != current_user` e `read_at == null`. Usado pelo polling de 60s no `App.tsx` para atualizar badge de notificações.
- [ ] **Mesclar PR #36 (ou #34)**: Traz `ChatListScreen`, `unread_count` server-side, idempotência e subcategory loading. Revisar e mesclar após resolver conflitos.

### 🟠 Alto (impacta UX principal)

- [ ] **`ChatListScreen` no mobile**: Tela para o usuário navegar entre todas as suas conversas ativas. Atualmente não há ponto de entrada para ver a lista de chats. Aguarda PR #36.
- [ ] **Idempotency key para criação de contato**: Protege o profissional de perder créditos em clique duplo / retry. Aguarda PR #36.
- [ ] **Subcategory loading no login**: Profissional deve ter subcategorias carregadas ao fazer login para o filtro de projetos funcionar automaticamente. Aguarda PR #36.

### 🟡 Médio (qualidade/documentação)

- [ ] **Corrigir nomes de endpoints no README**: `GET /auth/turnstile-verify` → `GET /auth/turnstile-site-key`; `POST /auth/google-login` → `POST /auth/google`.
- [ ] **Configurar cron para `expire_featured_projects.py`**: Adicionar ao `docker-compose.yml` ou documentar setup de cron no servidor.
- [ ] **Aumentar cobertura de testes**: Adicionar testes para `unread_count`, rota FCM e idempotência de contato.
- [ ] **Fechar PR #37**: Está vazio e polui a lista de PRs abertos.

### 🟢 Baixo (nice-to-have)

- [ ] **Validar `CORS_ORIGINS` em produção**: Garantir que a variável de ambiente está configurada corretamente para `agilizapro.cloud`.
- [ ] **Documentar variáveis AWS** necessárias para `export-logs-s3` job.
- [ ] **Automatizar testes de integração** para WebSocket (atualmente não há testes para o fluxo WS).

---

## Resumo de Status por Domínio

| Domínio | Status | Gaps |
|---------|--------|------|
| Autenticação | ✅ OK | Nomes de endpoints no README divergem levemente |
| Projetos | ✅ OK | Filtro subcategoria precisa de PR #36 |
| Créditos Dinâmicos | ✅ OK | — |
| Contatos (Leads) | ⚠️ Parcial | Falta idempotência (PR #36) |
| Chat + Push | ⚠️ Parcial | FCM route não exposta; `unread_count` ausente; ChatListScreen falta |
| Avaliações/Ranking | ✅ OK | — |
| Projetos Destacados | ✅ OK | — |
| Créditos/Assinaturas | ✅ OK | — |
| Anúncios | ✅ OK | — |
| Busca Inteligente | ✅ OK | — |
| Suporte (SAC) | ✅ OK | — |
| Upload/Documentos | ✅ OK | — |
| Admin Panel | ✅ OK | — |
| Professional Panel | ✅ OK | — |
| Background Jobs | ✅ OK | Cron requer setup manual |
| Segurança | ✅ OK | — |
| Testes | ✅ OK | Gaps não cobertos por testes |
| Deploy | ✅ OK | — |
