                        # Professional Platform Backend

Backend completo para uma plataforma que conecta profissionais e clientes, similar ao GetNinjas/Workana.

## 🚀 Funcionalidades

- **Autenticação JWT** com refresh tokens
- **Sistema de usuários** com roles (cliente/profissional)
- **Gerenciamento de projetos** com geocodificação
- **Sistema de contatos** com consumo de créditos
- **Assinaturas** e planos de créditos
- **WebSockets** para comunicação em tempo real
- **Integração Google Maps** para geocodificação

## 🛠️ Tecnologias

- **FastAPI** - Framework web assíncrono
- **MongoDB** com **Motor** - Banco de dados NoSQL
- **Pydantic v2** - Validação de dados
- **WebSockets** - Comunicação em tempo real
- **JWT** - Autenticação
- **Google Maps API** - Geocodificação

## 📁 Estrutura do Projeto

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py      # Configurações da aplicação
│   │   ├── security.py    # Utilitários de segurança
│   │   └── database.py    # Conexão MongoDB
│   ├── models/            # Modelos Pydantic
│   ├── schemas/           # Schemas de entrada/saída
│   ├── crud/              # Operações CRUD
│   ├── api/
│   │   ├── endpoints/     # Endpoints REST
│   │   └── websockets/    # WebSocket routes
│   ├── services/          # Serviços externos
│   └── utils/             # Utilitários
├── requirements.txt
├── .env.example
└── Dockerfile
```

## 🚀 Instalação e Execução

### Opção 1: Docker Compose (Recomendado - inclui MongoDB)

```bash
# Construir e executar com MongoDB
docker-compose up --build
```

O app estará disponível em `http://localhost:8000` e MongoDB em `localhost:27017`.

### Opção 2: Ambiente Virtual Local

#### 1. Instalar MongoDB localmente
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mongodb

# macOS com Homebrew
brew install mongodb-community
brew services start mongodb-community

# Windows - baixar do site oficial
# https://www.mongodb.com/try/download/community
```

#### 2. Clonar e configurar
```bash
git clone <repository-url>
cd backend

python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate no Windows

pip install -r requirements.txt
cp .env.example .env
# Editar .env com suas configurações
```

#### 3. Executar
```bash
uvicorn app.main:app --reload
```

## 📚 Documentação da API

Acesse `http://localhost:8000/docs` para a documentação interativa Swagger UI.

## 🔑 Principais Endpoints

### Autenticação
- `POST /auth/register` - Registrar usuário
- `POST /auth/login` - Login JWT
- `POST /auth/refresh` - Refresh token

### Usuários
- `GET /users/me` - Perfil do usuário
- `PUT /users/me` - Atualizar perfil
- `GET /users/professionals/nearby` - Profissionais próximos

### Projetos
- `POST /projects` - Criar projeto
- `GET /projects` - Listar projetos
- `GET /projects/nearby` - Projetos próximos

### Contatos
- `POST /contacts/{project_id}` - Contatar cliente
- `GET /contacts/history` - Histórico de contatos

### Assinaturas
- `GET /subscriptions/plans` - Listar planos
- `POST /subscriptions/subscribe` - Assinar plano

## 🌐 WebSockets

Conecte-se ao WebSocket em `/ws/{user_id}` para notificações em tempo real.

Eventos suportados:
- `new_project` - Novos projetos na área
- `contact_update` - Atualizações de contato
- `notification` - Notificações gerais

## 🗺️ Geocodificação

O sistema usa Google Maps API para:
- Geocodificar endereços em coordenadas
- Buscar profissionais/projetos por proximidade
- Índices geoespaciais otimizados no MongoDB

## 💳 Sistema de Créditos

- Usuários consomem créditos para contatar clientes
- Créditos são gerenciados por assinaturas
- Validações automáticas antes de contato

## 🐳 Docker

### Docker Compose (Completo com MongoDB)
```bash
# Construir e executar
docker-compose up --build

# Executar em background
docker-compose up -d --build

# Parar serviços
docker-compose down

# Ver logs
docker-compose logs -f
```

### Docker Standalone (apenas app)
```bash
# Construir imagem
docker build -t professional-platform .

# Executar (precisa de MongoDB separado)
docker run -p 8000:8000 \
  -e MONGODB_URL=mongodb://your-mongo-url \
  -e JWT_SECRET_KEY=your-secret \
  professional-platform
```

## 🔧 Troubleshooting

### Problemas com Docker
```bash
# Se não conseguir executar docker-compose
sudo usermod -aG docker $USER
# Reinicie o terminal ou faça logout/login

# Verificar status dos containers
docker-compose ps

# Ver logs detalhados
docker-compose logs

# Limpar containers e volumes
docker-compose down -v
docker system prune -a
```

### Problemas com MongoDB
```bash
# Conectar ao MongoDB no container
docker exec -it professional_platform_mongodb mongosh -u admin -p password123

# Verificar conexão
docker run --rm --network backend_professional_platform_network mongo:7.0 mongo --host mongodb --username admin --password password123 professional_platform
```

### Problemas com dependências Python
```bash
# Limpar cache e reinstalar
pip uninstall -r requirements.txt -y
pip install -r requirements.txt
```

## 🧪 Testes Locais

### 🔍 Verificar Configuração
```bash
# Script para verificar qual MongoDB está sendo usado
./check-mongo.sh
```

### Opção 1: Docker Compose (Recomendado)
```bash
# Ambos containers sobem juntos
docker-compose up --build

# ✅ Testes usam MongoDB do container
# API: http://localhost:8000
# MongoDB: localhost:27017 (porta do host → container)
```

### Opção 2: Ambiente Virtual + MongoDB Container
```bash
# 1. Subir apenas MongoDB
docker-compose up mongodb -d

# 2. Ambiente virtual local
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. .env já está configurado para o container
# MONGODB_URL=mongodb://admin:password123@mongodb:27017/...

# 4. Executar localmente
uvicorn app.main:app --reload

# ✅ Testes locais usam MongoDB do container
```

### Opção 3: Tudo Local (MongoDB no sistema)
```bash
# 1. Instalar MongoDB localmente
sudo apt install mongodb

# 2. Ambiente virtual
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configurar .env para MongoDB local
cp .env.local .env
# Ou editar .env: MONGODB_URL=mongodb://localhost:27017

# 4. Executar
uvicorn app.main:app --reload

# ✅ Testes locais usam MongoDB do sistema
```

## 🔒 Segurança

- JWT tokens com expiração
- Senhas hasheadas com bcrypt
- Validação de roles e ownership
- Rate limiting (configurável)
- CORS configurado

## 📊 Banco de Dados

### Índices Criados Automaticamente
- `users.email` (único)
- `users.coordinates` (2dsphere)
- `projects.location.coordinates` (2dsphere)
- `projects.client_id`
- `projects.status`
- `contacts.professional_id`
- `contacts.project_id`

## 🧪 Testes

Para executar testes (quando implementados):
```bash
pytest
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.