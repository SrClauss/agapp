# 🧪 Guia de Configuração do Ambiente de Testes

Este guia mostra como configurar rapidamente um ambiente local para testar a aplicação.

---

## 📋 **Pré-requisitos**

- Docker e Docker Compose instalados
- Python 3.11+ (se rodar sem Docker)
- Node.js 18+ (para o mobile)

---

## 🚀 **Setup Rápido (Com Docker)**

### **1. Clone e entre no diretório**

```bash
git clone <repo-url>
cd agapp
```

### **2. Crie o arquivo .env**

```bash
# Copie o template
cp .env.example .env

# Edite com seus valores
nano .env
```

### **3. Configure variáveis mínimas**

Edite o `.env` e adicione pelo menos estas variáveis:

```bash
# Banco de dados (já funciona com Docker)
MONGODB_URL=mongodb://admin:senha123@mongodb:27017/agiliza?authSource=admin
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=senha123
DATABASE_NAME=agiliza

# JWT (gere uma senha aleatória)
JWT_SECRET_KEY=minha_senha_super_secreta_para_testes_12345

# APIs (pode deixar fake para testes locais)
GOOGLE_MAPS_API_KEY=fake_key_for_local_testing
ASAAS_API_KEY=fake_asaas_key
TURNSTILE_SECRET_KEY=fake_turnstile_key
TURNSTILE_SITE_KEY=fake_turnstile_site_key

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000","http://localhost:19006"]

# Firebase (opcional - deixe vazio se não tiver)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_CLIENT_X509_CERT_URL=
```

### **4. Suba os containers**

```bash
docker-compose up -d
```

### **5. Verifique os logs**

```bash
# Ver todos os logs
docker-compose logs -f

# Ver só do backend
docker-compose logs -f backend

# Ver se Firebase inicializou
docker-compose logs backend | grep Firebase
```

**Saída esperada:**
```
⚠️ Warning: Firebase credentials not configured
   Push notifications will NOT work until you configure Firebase credentials
```
(Isso é normal se você não configurou Firebase ainda)

### **6. Acesse a aplicação**

- **API Docs:** http://localhost/docs
- **Backend direto:** http://localhost:8000 (se expôs a porta)
- **Admin:** http://localhost/system-admin

---

## 🐍 **Setup sem Docker (Desenvolvimento)**

### **1. Instale dependências Python**

```bash
cd backend
pip install -r requirements.txt
```

### **2. Configure MongoDB local**

```bash
# Instale MongoDB (Ubuntu/Debian)
sudo apt-get install mongodb

# Ou use Docker só pro MongoDB
docker run -d -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=senha123 \
  mongo:7.0
```

### **3. Crie .env no backend**

```bash
cd backend
cp ../.env.example .env
nano .env
```

Ajuste o `MONGODB_URL` para apontar para localhost:
```bash
MONGODB_URL=mongodb://admin:senha123@localhost:27017/agiliza?authSource=admin
```

### **4. Rode o servidor**

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### **5. Acesse**

- **API:** http://localhost:8000/docs

---

## 🔥 **Adicionar Firebase (Opcional)**

Se quiser testar notificações push:

### **1. Baixe as credenciais**

1. Acesse: https://console.firebase.google.com/project/agilizzapp-206f1
2. Settings → Service Accounts → Generate new private key
3. Baixe o JSON

### **2. Extraia as credenciais**

```bash
python scripts/extract-firebase-creds.py caminho/para/firebase-adminsdk.json
```

### **3. Cole no .env**

Copie a saída do script e cole no seu `.env`.

### **4. Reinicie**

```bash
# Com Docker
docker-compose restart backend

# Sem Docker
# Ctrl+C e rode uvicorn novamente
```

### **5. Verifique**

```bash
docker-compose logs backend | grep Firebase
```

**Saída esperada:**
```
✅ Firebase Admin SDK initialized from environment variables
```

---

## 📱 **Setup do Mobile (Expo)**

### **1. Entre no diretório**

```bash
cd mobile
```

### **2. Instale dependências**

```bash
npm install
```

### **3. Configure .env do mobile**

```bash
cp .env.example .env
nano .env
```

Ajuste o `BACKEND_URL`:
```bash
# Se backend local
BACKEND_URL=http://localhost:8000

# Se backend em Docker
BACKEND_URL=http://192.168.1.100:80  # Use seu IP local

# Se backend em produção
BACKEND_URL=https://agilizapro.cloud
```

### **4. Adicione google-services.json**

1. Baixe do Firebase Console
2. Coloque em `mobile/google-services.json`

### **5. Rode o Expo**

```bash
npm start
```

Escaneie o QR Code no Expo Go app.

---

## 🧪 **Testar Funcionalidades**

### **1. Criar usuário**

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "senha123",
    "full_name": "Usuário Teste",
    "cpf": "12345678900",
    "roles": ["client", "professional"]
  }'
```

### **2. Fazer login**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teste@example.com",
    "password": "senha123"
  }'
```

Copie o `access_token` retornado.

### **3. Registrar FCM token**

```bash
curl -X POST http://localhost:8000/users/me/fcm-token \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "test-token-fake-123",
    "device_id": "test-device-001",
    "device_name": "Test Device"
  }'
```

### **4. Criar projeto próximo**

```bash
curl -X POST http://localhost:8000/projects \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Reforma de banheiro",
    "description": "Preciso reformar meu banheiro",
    "category": {"main": "Construção", "sub": "Reforma"},
    "location": {
      "address": "Av Paulista, 1000 - São Paulo, SP",
      "coordinates": [-46.6527, -23.5629]
    },
    "budget_min": 1000,
    "budget_max": 5000,
    "remote_execution": false
  }'
```

### **5. Buscar projetos próximos**

```bash
curl -X GET "http://localhost:8000/projects/nearby/non-remote?latitude=-23.5629&longitude=-46.6527&radius_km=10" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

---

## 🔍 **Troubleshooting**

### **MongoDB não conecta**

```bash
# Ver logs do MongoDB
docker-compose logs mongodb

# Verificar se está rodando
docker ps | grep mongodb

# Reiniciar
docker-compose restart mongodb
```

### **Backend não inicia**

```bash
# Ver erros
docker-compose logs backend

# Verificar variáveis
docker-compose config

# Reconstruir
docker-compose build backend
docker-compose up -d backend
```

### **Firebase não inicializa**

```bash
# Ver logs
docker-compose logs backend | grep -i firebase

# Verificar variáveis
docker exec agiliza_backend env | grep FIREBASE

# Testar se as variáveis estão corretas
docker exec agiliza_backend python -c "from app.core.config import settings; print(settings.firebase_project_id)"
```

### **Port já em uso**

```bash
# Mudar porta no docker-compose.yml
# Ex: mudar "80:80" para "8080:80"

# Ou matar processo que usa a porta
sudo lsof -i :80
sudo kill -9 PID
```

---

## 🎯 **Próximos Passos**

Depois de configurar o ambiente:

1. ✅ Teste os endpoints via `/docs`
2. ✅ Configure o mobile e teste no dispositivo
3. ✅ Teste notificações push (se Firebase configurado)
4. ✅ Teste WebSocket para chat em tempo real

---

## 📞 **Precisa de Ajuda?**

- Verifique logs: `docker-compose logs -f backend`
- Veja documentação: `FIREBASE_SETUP.md`
- Teste endpoints: http://localhost:8000/docs
