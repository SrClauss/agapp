# Sistema de Precificação Dinâmica de Créditos

## Visão Geral

O sistema de precificação dinâmica ajusta o custo de créditos para profissionais com base na idade do projeto e histórico de contatos. Isso incentiva respostas rápidas e recompensa profissionais que agem primeiro.

## Regras de Precificação

### Projetos Novos (Sem Contatos Prévios)

| Idade do Projeto | Créditos | Código de Razão |
|------------------|----------|-----------------|
| 0-24 horas | 3 créditos | `new_project_0_24h` |
| 24-36 horas | 2 créditos | `new_project_24_36h` |
| 36+ horas | 1 crédito | `new_project_36h_plus` |

### Projetos com Contatos Existentes

| Tempo Desde Primeiro Contato | Créditos | Código de Razão |
|------------------------------|----------|-----------------|
| 0-24 horas | 2 créditos | `contacted_project_0_24h_after_first` |
| 24+ horas | 1 crédito | `contacted_project_24h_plus_after_first` |

## Arquitetura

### Componentes Principais

1. **`app/utils/credit_pricing.py`** - Lógica central de precificação
   - `calculate_contact_cost()` - Calcula custo baseado em regras
   - `validate_and_deduct_credits()` - Deduz créditos atomicamente
   - `record_credit_transaction()` - Registra transação para auditoria

2. **`app/api/endpoints/contacts.py`** - Endpoints HTTP
   - `GET /contacts/{project_id}/cost-preview` - Visualizar custo antes de contatar
   - `POST /contacts/{project_id}` - Criar contato (deduz créditos)

3. **`tests/test_dynamic_credit_pricing.py`** - Testes unitários
   - 9 testes cobrindo todos os cenários de precificação
   - Testes para locking atômico e tratamento de erros

## Mecanismo de Locking Atômico

Para prevenir condições de corrida (race conditions) onde dois profissionais tentam pegar o mesmo lead simultaneamente, usamos MongoDB's `find_one_and_update` com verificação de saldo:

```python
result = await db.subscriptions.find_one_and_update(
    {
        "user_id": user_id,
        "credits": {"$gte": credits_needed}  # Verifica saldo suficiente
    },
    {
        "$inc": {"credits": -credits_needed},  # Decrementa atomicamente
        "$set": {"updated_at": datetime.now(timezone.utc)}
    },
    return_document=True
)
```

### Por Que Isso Funciona?

- MongoDB garante que a operação `find_one_and_update` é atômica
- A consulta `{"credits": {"$gte": credits_needed}}` é parte da condição de update
- Se dois requests chegam simultaneamente:
  - Primeiro: Encontra subscription com 3 créditos, deduz 3 → novo saldo 0
  - Segundo: Não encontra subscription com 3 créditos (saldo é 0) → falha

## Fluxo de Criação de Contato

```
1. Cliente → POST /contacts/{project_id}
   ↓
2. Calcular custo (calculate_contact_cost)
   - Buscar projeto
   - Verificar idade do projeto
   - Verificar contatos existentes
   - Retornar (créditos_necessários, razão)
   ↓
3. Deduzir créditos (validate_and_deduct_credits)
   - find_one_and_update atômico
   - Se falhar → retornar erro "Créditos insuficientes"
   ↓
4. Criar contato (create_contact)
   - Salvar no banco com créditos usados
   ↓
5. Registrar transação (record_credit_transaction)
   - Salvar em credit_transactions para auditoria
   - Incluir metadata (project_id, razão de precificação)
   ↓
6. Enviar notificação push ao cliente
   ↓
7. Retornar contato criado
```

## Uso da API

### Visualizar Custo Antes de Contatar

```http
GET /contacts/{project_id}/cost-preview
Authorization: Bearer <token>
```

**Resposta:**
```json
{
  "credits_cost": 3,
  "reason": "new_project_0_24h",
  "current_balance": 10,
  "can_afford": true
}
```

### Criar Contato

```http
POST /contacts/{project_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "contact_type": "proposal",
  "contact_details": {
    "message": "Olá, tenho interesse no projeto!",
    "proposal_price": 500.00
  }
}
```

**Resposta de Sucesso (201):**
```json
{
  "id": "01HQXYZ...",
  "professional_id": "user123",
  "project_id": "proj456",
  "client_id": "client789",
  "credits_used": 3,
  "status": "pending",
  "created_at": "2025-01-22T15:30:00Z"
}
```

**Resposta de Erro (400):**
```json
{
  "detail": "Insufficient credits (have 1, need 3)"
}
```

## Auditoria e Transações

Cada dedução de crédito é registrada na coleção `credit_transactions`:

```json
{
  "_id": "01HQXYZ...",
  "user_id": "user123",
  "type": "contact",
  "credits": -3,
  "price": 0.0,
  "currency": "BRL",
  "metadata": {
    "project_id": "proj456",
    "contact_id": "contact789",
    "pricing_reason": "new_project_0_24h"
  },
  "status": "completed",
  "created_at": "2025-01-22T15:30:00Z"
}
```

### Consultas de Auditoria

```javascript
// Ver todas as transações de um usuário
db.credit_transactions.find({ user_id: "user123" })

// Ver total de créditos gastos por usuário
db.credit_transactions.aggregate([
  { $match: { type: "contact" } },
  { $group: { _id: "$user_id", total: { $sum: "$credits" } } }
])

// Ver distribuição de preços pagos
db.credit_transactions.aggregate([
  { $match: { type: "contact" } },
  { $group: { 
      _id: "$metadata.pricing_reason",
      count: { $sum: 1 },
      total_credits: { $sum: { $abs: "$credits" } }
  }}
])
```

## Testes

Execute os testes com:

```bash
cd backend
pytest tests/test_dynamic_credit_pricing.py -v
```

### Cobertura de Testes

- ✅ Projeto novo 0-24h → 3 créditos
- ✅ Projeto novo 24-36h → 2 créditos  
- ✅ Projeto novo 36h+ → 1 crédito
- ✅ Projeto contatado 0-24h após primeiro → 2 créditos
- ✅ Projeto contatado 24h+ após primeiro → 1 crédito
- ✅ Dedução atômica bem-sucedida
- ✅ Erro de créditos insuficientes
- ✅ Erro de subscription inexistente
- ✅ Registro de transação

## Configuração

Não há configuração necessária. O sistema usa as regras hardcoded definidas no código.

Para ajustar as regras de precificação, edite `app/utils/credit_pricing.py`:

```python
# Exemplo: Mudar janela de 24h para 48h
if hours_since_creation <= 48:  # antes: 24
    return 3, "new_project_0_48h"
```

## Monitoramento

### Métricas Recomendadas

1. **Distribuição de Preços Pagos**
   - Quantos contatos custaram 1, 2, 3 créditos?
   - Isso indica se profissionais estão agindo rápido

2. **Taxa de Conversão por Preço**
   - Profissionais que pagam 3 créditos têm maior taxa de fechamento?

3. **Saldo Médio de Créditos**
   - Profissionais estão ficando sem créditos?

4. **Erros de Créditos Insuficientes**
   - Quantas tentativas de contato falham por falta de créditos?

### Logs

O sistema loga automaticamente:
- Falhas de dedução de créditos (com razão)
- Criação de contatos
- Transações registradas

## Troubleshooting

### "Insufficient credits" mesmo com saldo

**Causa:** Condição de corrida ou saldo desatualizado

**Solução:** O sistema já usa locking atômico. Verifique se há múltiplos requests simultâneos do mesmo usuário.

### Preço incorreto calculado

**Causa:** Timezone incorreto no created_at do projeto

**Solução:** Sempre use `datetime.now(timezone.utc)` ao criar projetos. O helper `ensure_utc()` em `app/utils/timezone.py` normaliza timezones.

### Transação não registrada

**Causa:** Erro após dedução mas antes de registro

**Solução:** Isso é raro mas possível. Adicione retry logic ou implemente transação distribuída se crítico.

## Roadmap Futuro

- [ ] Preços dinâmicos baseados em demanda (projetos populares custam mais)
- [ ] Descontos para profissionais com alta taxa de conversão
- [ ] Sistema de "créditos promocionais" com validade
- [ ] API de reembolso de créditos (se contato não responde em X dias)
- [ ] Dashboard de analytics de precificação para admin

## Suporte

Para dúvidas ou problemas, consulte:
- Código: `backend/app/utils/credit_pricing.py`
- Testes: `backend/tests/test_dynamic_credit_pricing.py`
- Endpoint: `backend/app/api/endpoints/contacts.py`
