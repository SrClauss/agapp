# Guia de Configuração: Push Notifications e Webhooks Asaas

## 📱 Push Notifications com Firebase Cloud Messaging (FCM)

### Pré-requisitos

1. Conta no [Firebase Console](https://console.firebase.google.com/)
2. Projeto Firebase criado
3. Aplicativo iOS/Android registrado no projeto

### Passo 1: Obter Credenciais do Firebase

#### Via Console Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Configurações do Projeto** (ícone de engrenagem) → **Contas de Serviço**
4. Clique em **Gerar nova chave privada**
5. Salve o arquivo JSON baixado

#### Configurar no Backend

**Opção 1: Variáveis de Ambiente (RECOMENDADO para produção)**

Adicione as seguintes variáveis ao seu `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
```

**Opção 2: Arquivo JSON (para desenvolvimento local)**

Coloque o arquivo JSON baixado na raiz do backend com o nome do seu projeto, por exemplo:
```
backend/agilizzapp-206f1-firebase-adminsdk-fbsvc-6b55054773.json
```

O backend detectará automaticamente o arquivo.

### Passo 2: Configurar App Mobile

#### iOS (React Native)

1. Instalar dependências:
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

2. Adicionar GoogleService-Info.plist ao projeto iOS

3. Configurar notificações no código:
```typescript
import messaging from '@react-native-firebase/messaging';

// Solicitar permissão
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
  }
}

// Obter token FCM
async function getFCMToken() {
  const fcmToken = await messaging().getToken();
  console.log('FCM Token:', fcmToken);
  
  // Enviar token para o backend
  await api.post('/api/users/fcm-token', { token: fcmToken });
}
```

#### Android (React Native)

1. Adicionar google-services.json ao `android/app/`

2. Configurar gradle (`android/build.gradle`):
```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

3. No `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### Passo 3: Enviar Notificações do Backend

O backend já está configurado para enviar notificações. Exemplos de uso:

```python
from app.core.firebase import send_multicast_notification

# Enviar para múltiplos tokens
await send_multicast_notification(
    fcm_tokens=["token1", "token2"],
    title="Nova Proposta",
    body="Você recebeu uma nova proposta!",
    data={
        "type": "new_contact",
        "contact_id": "contact_123",
        "project_id": "project_456"
    }
)
```

### Testar Push Notifications

#### Via Mock (testes)

```python
from tests.mocks.firebase_mock import mock_firebase_messaging

# Configurar mock
mock_firebase_messaging.reset()

# Enviar notificação de teste
message = Message(
    notification=Notification(title="Test", body="Test message"),
    token="test_token"
)
await mock_firebase_messaging.send(message)

# Verificar que foi enviada
messages = mock_firebase_messaging.get_sent_messages("test_token")
assert len(messages) == 1
```

#### Via Firebase Console

1. Acesse Firebase Console → **Cloud Messaging**
2. Clique em **Enviar mensagem de teste**
3. Cole o FCM token do dispositivo
4. Envie a notificação

### Troubleshooting

**Problema:** Notificações não chegam no iOS

**Solução:**
1. Verificar se o certificado APNs está configurado no Firebase
2. Verificar se o app tem permissão de notificações
3. Testar em dispositivo real (não funciona no simulador)

**Problema:** "Firebase credentials not configured"

**Solução:**
1. Verificar se variáveis de ambiente estão configuradas
2. Ou verificar se arquivo JSON existe no caminho correto
3. Reiniciar o servidor backend

---

## 💰 Webhooks Asaas para Pagamentos

### O que são Webhooks?

Webhooks são notificações HTTP que o Asaas envia para seu backend quando eventos de pagamento ocorrem (confirmação, cancelamento, etc).

### Passo 1: Configurar Webhook no Asaas

1. Acesse [Asaas Dashboard](https://www.asaas.com/) (ou [Sandbox](https://sandbox.asaas.com/))
2. Vá em **Configurações** → **Integrações** → **Webhooks**
3. Clique em **Adicionar Webhook**
4. Configure:
   - **URL**: `https://seu-dominio.com/api/webhooks/asaas`
   - **Eventos**: Selecione os eventos desejados:
     - ✅ `PAYMENT_CREATED`
     - ✅ `PAYMENT_CONFIRMED` (PIX confirmado)
     - ✅ `PAYMENT_RECEIVED` (Cartão aprovado)
     - ✅ `PAYMENT_OVERDUE` (Pagamento vencido)
     - ✅ `PAYMENT_REFUNDED` (Estornado)
   - **Status**: Ativo
   - **Versão**: v3
5. Salve e copie o **Token de Autenticação**

### Passo 2: Configurar Backend

Adicione ao `.env`:

```env
# Asaas API
ASAAS_API_KEY=your-asaas-api-key
ASAAS_ENVIRONMENT=sandbox  # ou "production"
ASAAS_WEBHOOK_TOKEN=your-webhook-token

# Modo de teste (processa pagamentos imediatamente)
PAYMENT_TEST_MODE=true
```

### Passo 3: Eventos Suportados

O backend processa automaticamente os seguintes eventos:

#### PAYMENT_CONFIRMED / PAYMENT_RECEIVED

**Quando:** Pagamento confirmado (PIX ou Cartão)

**Ação:**
- Se `externalReference` = `"subscription:user_id:plan_id"`:
  - Ativa/renova assinatura
  - Adiciona créditos semanais ao usuário
  
- Se `externalReference` = `"credits:user_id:package_id"`:
  - Adiciona créditos ao usuário (base + bônus)
  - Registra transação
  
- Se `externalReference` = `"featured:user_id:project_id:days"`:
  - Ativa projeto destacado
  - Define `featured_until`

#### PAYMENT_OVERDUE

**Quando:** Pagamento vencido

**Ação:**
- Suspende assinatura (status → `"overdue"`)

#### PAYMENT_REFUNDED

**Quando:** Pagamento estornado

**Ação:**
- Remove créditos do usuário
- Cancela assinatura

### Passo 4: Testar Webhooks

#### Opção 1: Endpoint de Teste (Development)

```bash
# Comprar pacote de créditos (teste)
curl -X POST http://localhost:8000/api/webhooks/test-payment \
  -H "Content-Type: application/json" \
  -d '{
    "external_reference": "credits:user_id_here:package_id_here",
    "value": 50.00
  }'
```

#### Opção 2: Simular com Mock

```python
from tests.mocks.asaas_mock import mock_asaas_service

# Criar pagamento
payment = await mock_asaas_service.create_payment(
    customer_id="cus_123",
    billing_type="PIX",
    value=50.00,
    due_date=(datetime.now() + timedelta(days=1)).isoformat(),
    description="Test payment",
    external_reference="credits:user1:pack1"
)

# Confirmar pagamento
await mock_asaas_service.confirm_payment(payment["id"])

# Simular webhook
webhook_payload = mock_asaas_service.simulate_webhook_event(
    "PAYMENT_CONFIRMED",
    payment["id"]
)

# Enviar para endpoint
response = client.post("/api/webhooks/asaas", json=webhook_payload)
```

#### Opção 3: Webhook Real (Staging/Production)

1. Use [ngrok](https://ngrok.com/) para expor localhost:
```bash
ngrok http 8000
```

2. Configure a URL ngrok no Asaas Dashboard:
```
https://your-ngrok-url.ngrok.io/api/webhooks/asaas
```

3. Faça um pagamento de teste no Asaas
4. Webhook será enviado automaticamente

### Formato do External Reference

O campo `externalReference` identifica o tipo de pagamento:

| Formato | Descrição | Exemplo |
|---------|-----------|---------|
| `subscription:{user_id}:{plan_id}` | Assinatura mensal | `subscription:user_123:plan_pro` |
| `credits:{user_id}:{package_id}` | Pacote de créditos | `credits:user_123:pack_50` |
| `featured:{user_id}:{project_id}:{days}` | Projeto destacado | `featured:user_123:proj_456:7` |

### Verificar Webhooks Recebidos

Todos os webhooks são registrados no banco:

```python
# Buscar webhooks processados
webhooks = await db.payment_webhooks.find({
    "event_type": "PAYMENT_CONFIRMED",
    "processed": True
}).sort("created_at", -1).to_list(length=10)

for webhook in webhooks:
    print(f"Payment: {webhook['payment_id']}, Value: {webhook['value']}")
```

### Logs

Webhooks são logados automaticamente:

```bash
# Ver logs do backend
tail -f logs/app.log | grep webhook

# Exemplo de log
# 2025-01-22 16:00:00 - INFO - Webhook processado: PAYMENT_CONFIRMED - Payment: pay_123
```

### Troubleshooting

**Problema:** Webhook não chega no backend

**Solução:**
1. Verificar se URL está acessível (não pode ser localhost sem ngrok)
2. Verificar logs do Asaas Dashboard → Webhooks → Histórico
3. Testar com `curl` manualmente

**Problema:** "Assinatura de webhook inválida"

**Solução:**
1. Verificar se `ASAAS_WEBHOOK_TOKEN` está configurado
2. Token deve ser o mesmo do Asaas Dashboard

**Problema:** Créditos não adicionados após pagamento

**Solução:**
1. Verificar se `externalReference` está no formato correto
2. Verificar se usuário e pacote existem no banco
3. Verificar logs do backend

### Segurança

✅ **Implementado:**
- Validação de assinatura HMAC (se `ASAAS_WEBHOOK_TOKEN` configurado)
- Processamento em background (não bloqueia resposta)
- Registro de todos os webhooks recebidos

⚠️ **Recomendações:**
- Sempre use HTTPS em produção
- Configure `ASAAS_WEBHOOK_TOKEN` para validar assinaturas
- Monitore webhooks duplicados (idempotência)

### Monitoramento

```python
# Dashboard de webhooks
@router.get("/webhooks/stats")
async def get_webhook_stats(db: AsyncIOMotorDatabase):
    total = await db.payment_webhooks.count_documents({})
    processed = await db.payment_webhooks.count_documents({"processed": True})
    failed = await db.payment_webhooks.count_documents({"processed": False})
    
    return {
        "total": total,
        "processed": processed,
        "failed": failed,
        "success_rate": (processed / total * 100) if total > 0 else 0
    }
```

### Fluxo Completo de Pagamento

```
1. Usuário seleciona pacote → Frontend
2. Backend cria cobrança no Asaas → POST /api/payments/create
3. Asaas retorna QR Code PIX ou URL boleto
4. Usuário paga
5. Asaas envia webhook → POST /api/webhooks/asaas
6. Backend processa pagamento:
   - Adiciona créditos
   - Registra transação
   - Envia push notification
7. Frontend atualiza saldo do usuário
```

---

## 🧪 Testes Automatizados

### Rodar Testes

```bash
cd backend

# Todos os testes
pytest

# Apenas unit tests
pytest -m unit

# Apenas integration tests
pytest -m integration

# Apenas e2e tests
pytest -m e2e

# Com coverage
pytest --cov=app --cov-report=html
```

### Ver Cobertura

```bash
open htmlcov/index.html
```

---

## 🧪 Testes de Integração

### Testes Implementados

O arquivo `backend/tests/test_full_workflow_integration.py` contém 3 testes de integração completos:

#### 1. Fluxo Completo de Serviço (`test_complete_service_workflow`)
Testa o ciclo completo de um projeto:
- ✅ Cliente cria projeto remoto
- ✅ Profissional usa créditos para contactar (3 créditos - projeto novo)
- ✅ Troca de 3 mensagens entre cliente e profissional
- ✅ Status muda para "in_conversation"
- ✅ Cliente fecha o serviço
- ✅ Cliente avalia o profissional (5 estrelas)
- ✅ Verificação de dedução de créditos e transações

#### 2. Compra de Créditos via Asaas (`test_credit_purchase_with_asaas_webhook`)
Testa o fluxo de pagamento:
- ✅ Profissional inicia compra de pacote de créditos
- ✅ Mock Asaas processa pagamento PIX
- ✅ Webhook confirma pagamento
- ✅ 12 créditos são adicionados (10 + 2 bônus)
- ✅ Transação é registrada no histórico

#### 3. Notificações Push (`test_push_notification_flow`)
Testa o sistema de notificações:
- ✅ Notificação quando profissional cria contato
- ✅ Notificação quando cliente envia mensagem
- ✅ Notificação quando projeto é fechado
- ✅ Mock Firebase valida tokens e dados

### Como Rodar os Testes

```bash
cd backend

# Todos os testes de integração (requer MongoDB rodando)
pytest tests/test_full_workflow_integration.py -v

# Apenas um teste específico
pytest tests/test_full_workflow_integration.py::test_complete_service_workflow -v
pytest tests/test_full_workflow_integration.py::test_credit_purchase_with_asaas_webhook -v
pytest tests/test_full_workflow_integration.py::test_push_notification_flow -v
```

**Nota:** Estes testes requerem MongoDB rodando localmente ou via Docker:

```bash
# Iniciar MongoDB com Docker
docker run -d -p 27017:27017 --name mongodb-test mongo:latest

# Configurar variáveis de ambiente
export TEST_MONGODB_URL=mongodb://localhost:27017
export TEST_MONGODB_DB_NAME=agapp_test
```

---

## 📚 Referências

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Asaas API Docs](https://docs.asaas.com/)
- [Asaas Webhooks](https://docs.asaas.com/reference/webhooks)
- [React Native Firebase](https://rnfirebase.io/)
