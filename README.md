# AgApp - Marketplace de Serviços

## 📋 Visão Geral

AgApp é um marketplace que conecta clientes com profissionais de serviços. Clientes publicam projetos e profissionais usam créditos para obter leads e entrar em contato.

## 🏗️ Arquitetura

### Backend
- **Framework:** FastAPI (Python 3.12)
- **Banco de Dados:** MongoDB com Motor (driver assíncrono)
- **Autenticação:** JWT + Google Sign-In + Cloudflare Turnstile
- **Push Notifications:** Firebase Cloud Messaging
- **Pagamentos:** Asaas (PIX e Cartão)
- **WebSockets:** Para chat em tempo real

### Mobile
- **Framework:** React Native com Expo
- **Estado:** Zustand
- **Navegação:** React Navigation
- **UI:** React Native Paper
- **Mapas:** React Native Maps

## 📂 Estrutura do Projeto

```
agapp/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/     # Endpoints REST
│   │   │   └── websockets/    # WebSocket routes
│   │   ├── core/              # Config, segurança, database
│   │   ├── crud/              # Operações de banco de dados
│   │   ├── jobs/              # Background jobs (cron)
│   │   ├── models/            # Modelos Pydantic
│   │   ├── schemas/           # Schemas de validação
│   │   ├── services/          # Serviços externos (Asaas, geocoding)
│   │   └── utils/             # Utilitários
│   ├── tests/                 # Testes automatizados
│   ├── requirements.txt       # Dependências Python
│   └── pytest.ini            # Configuração de testes
├── mobile/
│   ├── src/
│   │   ├── api/              # Cliente HTTP
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── screens/          # Telas da aplicação
│   │   ├── stores/           # Estado Zustand
│   │   └── utils/            # Utilitários
│   └── package.json          # Dependências Node
└── docs/                     # Documentação
    ├── implementation-plan.md
    ├── dynamic-credit-pricing.md
    ├── ads-routes.md
    └── background-jobs.md
```

## 🚀 Features Principais

### ✅ Implementadas

#### 1. Autenticação & Perfis
- Login com e-mail/senha + Cloudflare Turnstile
- Login com Google (GSI nativo)
- Seleção de papel (cliente/profissional)
- Tela de anúncios antes da home

#### 2. Cadastro de Clientes & Projetos
- Fluxo de signup/complete-profile com CPF/telefone
- Criação de projeto com:
  - Título (limite 80 chars)
  - Descrição
  - Categoria e subcategorias
  - Orçamento (min/max)
  - Localização (mapa + geocoding automático)
  - Opção de execução remota

#### 3. Descoberta de Projetos (Profissionais)
- Listagem de projetos próximos (`/projects/nearby/combined`)
- Filtro para remotos vs presenciais
- **Ordenação:**
  - Por data de criação
  - Por destaque (featured first)
  - Por urgência (deadline proximity)
- **Badges dinâmicos:**
  - 🆕 "new" - Projeto < 24h
  - ⭐ "featured" - Projeto destacado ativo
  - ⏰ "expiring_soon" - Destaque expira em < 24h

#### 4. Sistema de Créditos Dinâmico ⭐
**Precificação inteligente baseada em idade do projeto:**
- Projetos novos (0-24h): **3 créditos**
- Projetos recentes (24-36h): **2 créditos**
- Projetos antigos (36h+): **1 crédito**
- Projetos com contatos existentes:
  - 0-24h após primeiro contato: **2 créditos**
  - 24h+ após primeiro contato: **1 crédito**

**Features técnicas:**
- ✅ Locking atômico (MongoDB `find_one_and_update`)
- ✅ Endpoint de preview de custo
- ✅ Registro individual de transações
- ✅ 9 testes unitários cobrindo todos os cenários

📖 [Documentação completa](docs/dynamic-credit-pricing.md)

#### 5. Chat em Tempo Real
- WebSocket `/ws/{user_id}`
- Endpoint REST alternativo `/contacts/{id}/messages`
- **Auto-detecção de primeira mensagem:**
  - Status muda para "in_conversation" automaticamente
- Push notifications bidirecionais

#### 6. Conclusão e Avaliação
- Endpoint `/projects/{id}/close` - Cliente marca como concluído
- Endpoint `/projects/{id}/evaluate` - Cliente avalia profissional (1-5 estrelas)
- **Atualização automática de ranking:**
  - Média truncada (exclui 10% outliers se ≥20 avaliações)
  - Armazenado em `user.average_rating`

#### 7. Projetos Destacados
- APIs `/api/payments/featured-project` (Asaas)
- Opções: 7, 15 ou 30 dias
- PIX ou Cartão de Crédito
- **Background job automático:**
  - Remove `is_featured` após `featured_until`
  - Executar via cron a cada hora

📖 [Documentação de background jobs](docs/background-jobs.md)

#### 8. Sistema de Anúncios
- 4 slots fixos:
  - `publi_screen_client` - Tela cheia para clientes
  - `publi_screen_professional` - Tela cheia para profissionais
  - `banner_client_home` - Banner home cliente
  - `banner_professional_home` - Banner home profissional
- Upload HTML/CSS/JS/imagens
- Cache local no mobile
- **Tracking real:**
  - Impressões: `POST /system-admin/api/public/ads/impression/{ad_type}`
  - Clicks: `POST /system-admin/api/public/ads/click/{ad_type}`
  - Logs em `logs/ad_impressions.log` e `logs/ad_clicks.log`

📖 [Documentação de rotas de ads](docs/ads-routes.md)

#### 9. Suporte via Tickets
- Backend `support.py` + WebSocket
- Tickets com chat em tempo real
- Rating pós-atendimento

### 🚧 Em Desenvolvimento

- [ ] Mobile: UI de chat completa
- [ ] Mobile: Tela de conclusão de projeto
- [ ] Mobile: Tela de avaliação
- [ ] Mobile: Tela "Meus Créditos" (saldo + histórico)
- [ ] Mobile: Loja de pacotes de créditos
- [ ] Mobile: Gerenciamento de assinaturas
- [ ] Mobile: Tela de suporte
- [ ] Dashboard admin para analytics
- [ ] Relatórios de ads (impressões/clicks)
- [ ] Lead events tracking (timestamps de ações)
- [ ] Reputation badges/níveis
- [ ] Middleware de logging para endpoints críticos
- [ ] Export de logs (S3)

## 🧪 Testes

### Backend

```bash
cd backend

# Instalar dependências
pip install -r requirements.txt

# Rodar todos os testes
pytest

# Rodar testes específicos
pytest tests/test_dynamic_credit_pricing.py -v

# Rodar com coverage
pytest --cov=app --cov-report=html

# Ver relatório de coverage
open htmlcov/index.html
```

### Testes Existentes
- ✅ 9 testes de precificação dinâmica de créditos
- ✅ Testes de admin grant
- ✅ Testes de complete profile
- ✅ Testes de contacted projects
- ✅ Testes de filtros de projetos
- ✅ Testes de geocoding
- ✅ Testes de transações

**Cobertura:** ~50% do código (configurado em pytest.ini)

## 🔧 Configuração

### Backend

1. **Instalar dependências:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Configurar variáveis de ambiente (.env):**
```env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=agapp

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Firebase
FIREBASE_CREDENTIALS_PATH=path/to/firebase-credentials.json

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your-turnstile-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Asaas Payments
ASAAS_API_KEY=your-asaas-api-key
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
```

3. **Rodar servidor:**
```bash
uvicorn app.main:app --reload
```

### Mobile

1. **Instalar dependências:**
```bash
cd mobile
npm install
```

2. **Configurar variáveis (.env):**
```env
API_URL=http://localhost:8000
```

3. **Rodar no emulador:**
```bash
# Android
expo run:android

# iOS
expo run:ios
```

## 📊 Background Jobs

### Featured Projects Expiration

Remove status de destaque de projetos expirados.

**Manual:**
```bash
cd backend
python -m app.jobs.expire_featured_projects
```

**Cron (recomendado):**
```cron
0 * * * * cd /path/to/backend && python -m app.jobs.expire_featured_projects
```

📖 [Documentação completa de jobs](docs/background-jobs.md)

## 🔒 Segurança

### Implementado
- ✅ JWT tokens com expiração
- ✅ Cloudflare Turnstile (anti-bot)
- ✅ Google OAuth
- ✅ Rate limiting (SlowAPI)
- ✅ Locking atômico para créditos
- ✅ Validação de entrada (Pydantic)
- ✅ CORS configurado

### Boas Práticas
- Senhas hasheadas com bcrypt
- Tokens em secure storage (mobile)
- Push tokens rotacionados
- HTTPS obrigatório em produção

## 📈 Monitoramento

### Logs Disponíveis
- `logs/ad_clicks.log` - Clicks em anúncios
- `logs/ad_impressions.log` - Impressões de anúncios
- Application logs (stdout)

### Métricas Recomendadas
- Taxa de conversão (leads → contratos)
- CTR de anúncios
- Distribuição de preços de créditos
- Tempo médio de resposta de profissionais
- Taxa de conclusão de projetos

## 🚀 Deploy

### Backend (Docker)

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t agapp-backend .
docker run -p 8000:8000 --env-file .env agapp-backend
```

### Mobile (EAS Build)

```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

## 📖 Documentação Adicional

- [Plano de Implementação](docs/implementation-plan.md) - Roadmap completo
- [Precificação Dinâmica](docs/dynamic-credit-pricing.md) - Sistema de créditos
- [Rotas de Anúncios](docs/ads-routes.md) - API de anúncios
- [Background Jobs](docs/background-jobs.md) - Jobs automáticos

## 🤝 Contribuindo

1. Todos os testes devem passar: `pytest`
2. Código deve seguir PEP 8 (Python) e ESLint (TypeScript)
3. Adicionar testes para novas features
4. Documentar mudanças em `/docs`

## 📄 Licença

Proprietary - Todos os direitos reservados

## 💬 Suporte

Para dúvidas técnicas, consulte a documentação em `/docs` ou abra uma issue no repositório.
