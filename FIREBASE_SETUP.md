# 🔥 Firebase Configuration Guide

Este guia explica como configurar o Firebase Cloud Messaging (FCM) usando variáveis de ambiente.

## 📋 **Pré-requisitos**

1. Conta no Firebase Console
2. Projeto Firebase criado (`agilizzapp-206f1`)
3. Service Account criada

---

## 🔑 **Opção 1: Variáveis de Ambiente (.env) - RECOMENDADO**

### **1. Obter Credenciais do Firebase**

1. Acesse: https://console.firebase.google.com/project/agilizzapp-206f1/settings/serviceaccounts/adminsdk
2. Clique em **"Generate new private key"**
3. Baixe o arquivo JSON

### **2. Extrair Valores do JSON**

O arquivo JSON terá este formato:

```json
{
  "type": "service_account",
  "project_id": "agilizzapp-206f1",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@agilizzapp-206f1.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/...",
  "universe_domain": "googleapis.com"
}
```

### **3. Adicionar ao .env**

Edite o arquivo `.env` e adicione:

```bash
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=agilizzapp-206f1
FIREBASE_PRIVATE_KEY_ID=abc123def456...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@agilizzapp-206f1.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
```

**⚠️ IMPORTANTE:**
- Use aspas duplas para `FIREBASE_PRIVATE_KEY`
- Mantenha os `\n` (quebras de linha) na chave privada
- **NUNCA** commite o arquivo `.env`!

### **4. Testar**

```bash
# Reiniciar o backend
docker-compose restart backend

# Verificar logs
docker-compose logs backend | grep Firebase
```

Você deve ver:
```
✅ Firebase Admin SDK initialized from environment variables
```

---

## 🗂️ **Opção 2: Arquivo JSON (Desenvolvimento Local)**

Se preferir usar arquivo JSON localmente:

1. Baixe o JSON do Firebase Console
2. Renomeie para: `backend/agilizzapp-206f1-firebase-adminsdk-fbsvc-6b55054773.json`
3. O código automaticamente usa este arquivo se não encontrar variáveis de ambiente

**Nota:** O arquivo JSON já está no `.gitignore` e não será commitado.

---

## 🚀 **Deploy em Produção**

### **No VPS/Servidor:**

1. **Adicione as variáveis de ambiente:**

```bash
# Edite o .env no servidor
nano /path/to/agapp/.env

# Cole as variáveis Firebase (veja passo 3 acima)
```

2. **Reinicie o serviço:**

```bash
docker-compose down
docker-compose up -d
```

### **Variáveis de Ambiente do Sistema (Alternativa):**

```bash
export FIREBASE_PROJECT_ID="agilizzapp-206f1"
export FIREBASE_PRIVATE_KEY_ID="abc123..."
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@agilizzapp-206f1.iam.gserviceaccount.com"
export FIREBASE_CLIENT_ID="123456..."
export FIREBASE_CLIENT_X509_CERT_URL="https://www.googleapis.com/robot/v1/metadata/x509/..."
```

---

## 🧪 **Testar Push Notifications**

### **1. Registrar token FCM:**

```bash
curl -X POST https://agilizapro.cloud/users/me/fcm-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "test-token-123",
    "device_id": "device-001",
    "device_name": "Test Device"
  }'
```

### **2. Enviar mensagem de teste:**

Crie um ticket e envie uma mensagem. Se você estiver offline, deve receber uma push notification!

---

## 📱 **Mobile App (google-services.json)**

Para o app mobile, você ainda precisa do arquivo `google-services.json`:

1. **Baixe do Firebase Console:**
   - Vá em: Project Settings → Your apps → Android app
   - Clique em "Download google-services.json"

2. **Coloque em:**
   ```
   mobile/google-services.json
   ```

3. **Não commite!** (já está no `.gitignore`)

---

## ⚠️ **Segurança**

### **O que NUNCA commitar:**

❌ `.env` (contém secrets)
❌ `google-services.json` (contém API keys)
❌ `*firebase-adminsdk*.json` (contém private keys)

### **Arquivos seguros no repositório:**

✅ `.env.example` (template sem valores reais)
✅ `FIREBASE_SETUP.md` (este guia)
✅ Código-fonte (config.py, firebase.py)

---

## 🔄 **Rotação de Credenciais**

Se você precisar trocar as credenciais:

1. **Firebase Console** → Service Accounts
2. Delete a chave antiga
3. Gere uma nova chave
4. Atualize o `.env` com os novos valores
5. Reinicie o serviço

---

## 🆘 **Troubleshooting**

### **Erro: "Firebase not initialized"**

✅ Verifique se as variáveis estão no `.env`
✅ Reinicie o backend após adicionar variáveis
✅ Verifique logs: `docker-compose logs backend`

### **Erro: "Invalid private key"**

✅ Certifique-se que `FIREBASE_PRIVATE_KEY` tem aspas duplas
✅ Mantenha os `\n` na chave
✅ Exemplo correto: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

### **Push não chegam**

✅ Verifique se o token FCM foi registrado: `GET /users/me/fcm-tokens`
✅ Teste se o usuário está offline (feche o app)
✅ Verifique logs do backend: `docker-compose logs -f backend`

---

## 📞 **Suporte**

Se precisar de ajuda, verifique:
- Logs do backend: `docker-compose logs backend`
- Firebase Console: https://console.firebase.google.com/project/agilizzapp-206f1
- Documentação Firebase: https://firebase.google.com/docs/admin/setup
