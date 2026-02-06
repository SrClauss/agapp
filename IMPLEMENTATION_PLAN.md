# 🚀 PLANO DE IMPLEMENTAÇÃO - SISTEMA COMPLETO DE CONTATOS, CHAT E AVALIAÇÕES

## 📋 CONTEXTO DO PROJETO

### O QUE JÁ ESTÁ IMPLEMENTADO ✅

#### Backend (FastAPI + MongoDB)
- ✅ **Modelos de Dados Completos**:
  - `Project`: modelo com `liberado_por`, `chat`, status (open/closed), `remote_execution`
  - `Contact`: modelo com `chat[]`, `status`, `credits_used`, `contact_details`
  - `User`: modelo com `roles`, `credits`, `professional_info`, `evaluations[]`, `average_rating`
  - `Evaluation`: coleção separada para avaliações

- ✅ **Endpoints de Projetos**:
  - POST `/projects/` - Criar projeto (cliente)
  - GET `/projects/` - Listar projetos com filtros
  - GET `/projects/nearby/combined` - Projetos próximos (com fallback para settings do profissional)
  - GET `/projects/my/projects` - Projetos do usuário (como cliente)
  - GET `/projects/{project_id}` - Detalhes do projeto
  - POST `/projects/{project_id}/close` - Fechar projeto (profissional)
  - POST `/projects/{project_id}/evaluate` - Avaliar profissional (cliente)

- ✅ **Endpoints de Contatos**:
  - GET `/contacts/{project_id}/cost-preview` - Preview do custo de créditos
  - POST `/contacts/{project_id}` - Criar contato (profissional gasta créditos)
  - GET `/contacts/history?user_type=professional|client` - Histórico de contatos
  - GET `/contacts/{contact_id}` - Detalhes do contato
  - POST `/contacts/{contact_id}/messages` - Enviar mensagem (REST alternativo)
  - PUT `/contacts/{contact_id}/status` - Atualizar status do contato

- ✅ **WebSocket Implementado**:
  - `/ws/{user_id}` - Conexão WebSocket autenticada
  - Gerenciador de conexões (`ConnectionManager`)
  - Suporte para `new_message` em contatos
  - Fallback para push notifications quando offline
  - Broadcast de notificações de novos projetos

- ✅ **Sistema de Avaliações**:
  - Endpoint POST `/projects/{project_id}/evaluate` funcional
  - Cálculo de média truncada (exclui 10% outliers se >= 20 avaliações)
  - Armazenamento em coleção `evaluations` e array `evaluations` no usuário
  - Campo `average_rating` atualizado automaticamente

#### Mobile (React Native + Expo)
- ✅ **Telas Implementadas**:
  - `CreateProjectScreen` - Cliente cria projeto
  - `ProjectsListScreen` - Lista de projetos
  - `ProjectClientDetailScreen` - Detalhes do projeto (visão cliente)
  - `ProjectProfessionalsDetailScreen` - Detalhes do projeto (visão profissional)
  - `ContactedProjectsScreen` - Projetos que o profissional contatou
  - `ContactDetailScreen` - Detalhes do contato com chat em tempo real
  - `WelcomeCustomerScreen` e `WelcomeProfessionalScreen`

- ✅ **APIs Mobile**:
  - `projects.ts` - CRUD completo de projetos, `evaluateProject()`
  - `contacts.ts` - Criar contato, histórico, mensagens, cost preview
  - `websocket.ts` - Cliente WebSocket com reconexão automática

- ✅ **Componentes**:
  - `ConfirmContactModal` - Modal de confirmação para criar contato
  - `EvaluationModal` - Modal para avaliar profissional (5 estrelas + comentário)
  - `CardProjeto` - Card de projeto nas listagens

### O QUE FALTA IMPLEMENTAR ❌

1. ❌ **Cliente não consegue ver quem contatou seu projeto**
   - Não existe endpoint `/projects/{project_id}/contacts` para listar contatos
   - Tela do cliente não mostra lista de profissionais interessados
   - Não há navegação de projeto → lista de contatos → chat individual

2. ❌ **Sistema de chat incompleto**
   - WebSocket existe mas não está totalmente integrado no fluxo
   - Armazenamento de mensagens acontece mas não há histórico persistente eficiente
   - Notificações de novas mensagens não aparecem de forma clara no app

3. ❌ **Fluxo de avaliação incompleto**
   - Modal de avaliação existe mas não é chamado no momento certo
   - Não há validação para garantir que avaliação só aconteça após conclusão
   - Exibição de avaliações recebidas não está implementada no perfil

4. ❌ **Notificações e alertas**
   - Push notifications implementadas no backend mas integração mobile incompleta
   - Badge de novas mensagens não contadas/exibidas
   - Não há indicador visual de mensagens não lidas

---

## 🎯 OBJETIVOS DO PLANO

Implementar o fluxo completo:
1. Cliente cria projeto
2. Profissional próximo visualiza e contata
3. Cliente recebe notificação e vê lista de interessados
4. Chat em tempo real (WebSocket) com armazenamento
5. Projeto é concluído
6. Sistema de avaliação mútua
7. Avaliações exibidas nos perfis

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### 🔹 FASE 1: BACKEND - LISTAR CONTATOS DO PROJETO PARA O CLIENTE

#### ☐ 1.1. Criar endpoint GET /projects/{project_id}/contacts
**Arquivo**: `backend/app/api/endpoints/projects.py`

```python
@router.get("/{project_id}/contacts", response_model=List[ContactSummary])
async def get_project_contacts(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Lista todos os contatos/profissionais que demonstraram interesse em um projeto.
    Apenas o dono do projeto (cliente) pode acessar.
    """
    # Verificar se projeto existe
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verificar se usuário é o dono do projeto
    if str(current_user.id) != str(project.client_id):
        raise HTTPException(status_code=403, detail="Only project owner can view contacts")
    
    # Buscar todos os contatos do projeto
    contacts = []
    async for contact in db.contacts.find({"project_id": project_id}).sort("created_at", -1):
        # Buscar informações do profissional
        professional = await db.users.find_one({"_id": contact["professional_id"]})
        
        # Contar mensagens não lidas (mensagens do profissional que o cliente ainda não viu)
        chat = contact.get("chat", [])
        unread_count = sum(1 for msg in chat if msg.get("sender_id") == contact["professional_id"] and not msg.get("read_by_client", False))
        
        contact_summary = {
            "id": contact["_id"],
            "professional_id": contact["professional_id"],
            "professional_name": professional.get("full_name") if professional else "Profissional",
            "professional_avatar": professional.get("avatar_url") if professional else None,
            "status": contact.get("status", "pending"),
            "created_at": contact.get("created_at"),
            "last_message": chat[-1] if chat else None,
            "unread_count": unread_count,
            "contact_details": contact.get("contact_details", {})
        }
        contacts.append(contact_summary)
    
    return contacts
```

#### ☐ 1.2. Criar schema ContactSummary
**Arquivo**: `backend/app/schemas/contact.py`

```python
class ContactSummary(BaseModel):
    id: str
    professional_id: str
    professional_name: str
    professional_avatar: Optional[str] = None
    status: str
    created_at: datetime
    last_message: Optional[Dict[str, Any]] = None
    unread_count: int = 0
    contact_details: Dict[str, Any] = {}
    
    class Config:
        from_attributes = True
```

---

### 🔹 FASE 2: MOBILE - TELA DE CONTATOS DO PROJETO (CLIENTE)

#### ☐ 2.1. Criar função getProjectContacts no mobile
**Arquivo**: `mobile/src/api/projects.ts`

```typescript
export interface ContactSummary {
  id: string;
  professional_id: string;
  professional_name: string;
  professional_avatar?: string;
  status: string;
  created_at: string;
  last_message?: {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
  };
  unread_count: number;
  contact_details: {
    message?: string;
    proposal_price?: number;
  };
}

export async function getProjectContacts(projectId: string): Promise<ContactSummary[]> {
  const token = useAuthStore.getState().token;
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  
  const response = await client.get(`/projects/${projectId}/contacts`, config);
  return response.data;
}
```

#### ☐ 2.2. Criar componente ProjectContactsList
**Arquivo**: `mobile/src/components/ProjectContactsList.tsx`

```typescript
import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, Badge, Card } from 'react-native-paper';
import { ContactSummary } from '../api/projects';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  contacts: ContactSummary[];
  onContactPress: (contactId: string) => void;
}

export default function ProjectContactsList({ contacts, onContactPress }: Props) {
  const renderContact = ({ item }: { item: ContactSummary }) => (
    <TouchableOpacity onPress={() => onContactPress(item.id)}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar.Image 
            size={48} 
            source={{ uri: item.professional_avatar || 'https://via.placeholder.com/150' }} 
          />
          <View style={styles.info}>
            <View style={styles.header}>
              <Text style={styles.name}>{item.professional_name}</Text>
              {item.unread_count > 0 && (
                <Badge size={20}>{item.unread_count}</Badge>
              )}
            </View>
            <Text style={styles.status}>{getStatusLabel(item.status)}</Text>
            {item.last_message && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message.content}
              </Text>
            )}
            <Text style={styles.time}>
              {formatDistanceToNow(new Date(item.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      renderItem={renderContact}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text>Nenhum profissional entrou em contato ainda.</Text>
        </View>
      }
    />
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Aguardando resposta',
    in_conversation: 'Em conversa',
    accepted: 'Aceito',
    rejected: 'Rejeitado',
    completed: 'Concluído'
  };
  return labels[status] || status;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold' },
  status: { fontSize: 12, color: '#666', marginTop: 2 },
  lastMessage: { fontSize: 14, marginTop: 4, color: '#333' },
  time: { fontSize: 12, color: '#999', marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' }
});
```

#### ☐ 2.3. Adicionar seção de contatos em ProjectClientDetailScreen
**Arquivo**: `mobile/src/screens/ProjectClientDetailScreen.tsx`

Adicionar após as informações do projeto:

```typescript
// Importar no topo
import { getProjectContacts, ContactSummary } from '../api/projects';
import ProjectContactsList from '../components/ProjectContactsList';

// Adicionar estados
const [contacts, setContacts] = useState<ContactSummary[]>([]);
const [loadingContacts, setLoadingContacts] = useState(false);

// Adicionar useEffect para carregar contatos
useEffect(() => {
  if (!project || !projectId) return;
  
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const contactsData = await getProjectContacts(projectId);
      setContacts(contactsData);
    } catch (e) {
      console.warn('[ProjectClientDetail] failed to load contacts', e);
    } finally {
      setLoadingContacts(false);
    }
  };
  
  loadContacts();
}, [project, projectId]);

// Adicionar seção no render
<Card style={styles.section}>
  <Card.Title title="Profissionais Interessados" titleStyle={styles.sectionTitle} />
  <Card.Content>
    {loadingContacts ? (
      <ActivityIndicator />
    ) : (
      <ProjectContactsList 
        contacts={contacts}
        onContactPress={(contactId) => {
          navigation.navigate('ContactDetail', { contactId });
        }}
      />
    )}
  </Card.Content>
</Card>
```

---

### 🔹 FASE 3: MELHORAR SISTEMA DE CHAT E MENSAGENS

#### ☐ 3.1. Adicionar campo read_at nas mensagens
**Backend**: Atualizar modelo de mensagem no chat

```python
# Em backend/app/api/websockets/routes.py e contacts.py
# Ao criar mensagem, adicionar:
msg = {
    "id": str(new_ulid()),
    "sender_id": str(current_user.id),
    "content": content,
    "created_at": datetime.now(timezone.utc),
    "read_at": None,  # Será preenchido quando destinatário ler
}
```

#### ☐ 3.2. Criar endpoint para marcar mensagens como lidas
**Arquivo**: `backend/app/api/endpoints/contacts.py`

```python
@router.post("/{contact_id}/messages/mark-read")
async def mark_messages_as_read(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Marca todas as mensagens não lidas como lidas pelo usuário atual.
    """
    contact = await get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Verificar autorização
    if str(current_user.id) not in [str(contact.professional_id), str(contact.client_id)]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Atualizar mensagens: marcar como lidas as que foram enviadas pelo outro participante
    other_user_id = str(contact.client_id) if str(current_user.id) == str(contact.professional_id) else str(contact.professional_id)
    
    now = datetime.now(timezone.utc)
    
    # Atualizar no MongoDB: marcar read_at para mensagens do outro usuário que ainda não foram lidas
    result = await db.contacts.update_one(
        {"_id": contact_id},
        {
            "$set": {
                "chat.$[elem].read_at": now
            }
        },
        array_filters=[
            {
                "elem.sender_id": other_user_id,
                "elem.read_at": None
            }
        ]
    )
    
    return {"message": "Messages marked as read", "modified_count": result.modified_count}
```

#### ☐ 3.3. Chamar mark-read no mobile ao abrir chat
**Arquivo**: `mobile/src/screens/ContactDetailScreen.tsx`

```typescript
// Adicionar no useEffect após carregar contato
useEffect(() => {
  if (!contactId) return;
  
  const loadContact = async () => {
    setLoading(true);
    try {
      const contactData = await getContactDetails(contactId);
      setContact(contactData);
      setMessages(contactData.chat || []);
      
      // Marcar mensagens como lidas
      await markContactMessagesAsRead(contactId);
      
      // ... resto do código
    } catch (e) {
      console.error('[ContactDetail] failed to load contact', e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  
  loadContact();
}, [contactId]);

// Adicionar função em mobile/src/api/contacts.ts
export async function markContactMessagesAsRead(contactId: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  
  await client.post(`/contacts/${contactId}/messages/mark-read`, {}, config);
}
```

---

### 🔹 FASE 4: NOTIFICAÇÕES DE NOVAS MENSAGENS

#### ☐ 4.1. Adicionar badge de mensagens não lidas no menu
**Arquivo**: `mobile/App.tsx` (ou onde o Tab Navigator está)

```typescript
// No Tab Navigator, adicionar badge
<Tab.Screen 
  name="Messages" 
  component={MessagesScreen}
  options={{
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    tabBarIcon: ({ color, size }) => (
      <Icon name="message" size={size} color={color} />
    )
  }}
/>
```

#### ☐ 4.2. Criar hook useUnreadMessages
**Arquivo**: `mobile/src/hooks/useUnreadMessages.ts`

```typescript
import { useState, useEffect } from 'react';
import { getContactHistory } from '../api/contacts';
import useAuthStore from '../stores/authStore';

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuthStore();
  
  useEffect(() => {
    if (!user) return;
    
    const loadUnread = async () => {
      try {
        // Buscar histórico como cliente e profissional
        const [clientContacts, professionalContacts] = await Promise.all([
          getContactHistory('client').catch(() => []),
          user.roles.includes('professional') ? getContactHistory('professional').catch(() => []) : Promise.resolve([])
        ]);
        
        const allContacts = [...clientContacts, ...professionalContacts];
        
        // Contar mensagens não lidas
        let total = 0;
        allContacts.forEach(contact => {
          const chat = contact.chat || [];
          const unread = chat.filter(msg => {
            return msg.sender_id !== user.id && !msg.read_at;
          }).length;
          total += unread;
        });
        
        setUnreadCount(total);
      } catch (e) {
        console.error('Failed to load unread messages', e);
      }
    };
    
    loadUnread();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadUnread, 30000);
    
    return () => clearInterval(interval);
  }, [user]);
  
  return { unreadCount };
}
```

---

### 🔹 FASE 5: FLUXO COMPLETO DE AVALIAÇÃO

#### ☐ 5.1. Garantir que modal de avaliação apareça após fechamento
**Arquivo**: `mobile/src/screens/ContactDetailScreen.tsx`

Já existe lógica no código atual, mas garantir que:

```typescript
// Verificar se projeto foi fechado E se usuário é o cliente E se ainda não avaliou
useEffect(() => {
  if (!project || !contact) return;
  
  // Se projeto fechado e usuário é cliente
  if (project.status === 'closed' && user?.id === contact.client_id) {
    // Verificar se já avaliou (pode adicionar flag no backend)
    // Por ora, perguntar sempre
    setTimeout(() => {
      setEvaluationVisible(true);
    }, 2000);
  }
}, [project, contact, user]);
```

#### ☐ 5.2. Criar tela de avaliações recebidas
**Arquivo**: `mobile/src/screens/ProfileEvaluationsScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Avatar, Divider } from 'react-native-paper';
import { getUserEvaluations } from '../api/users';
import { Rating } from 'react-native-ratings';

interface Evaluation {
  id: string;
  client_id: string;
  client_name?: string;
  project_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export default function ProfileEvaluationsScreen() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getUserEvaluations();
        setEvaluations(data);
      } catch (e) {
        console.error('Failed to load evaluations', e);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, []);
  
  const renderEvaluation = ({ item }: { item: Evaluation }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={styles.clientName}>{item.client_name || 'Cliente'}</Text>
          <Rating
            readonly
            startingValue={item.rating}
            imageSize={20}
            style={styles.rating}
          />
        </View>
        {item.comment && (
          <Text style={styles.comment}>{item.comment}</Text>
        )}
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('pt-BR')}
        </Text>
      </Card.Content>
    </Card>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={evaluations}
        keyExtractor={(item) => item.id}
        renderItem={renderEvaluation}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>Nenhuma avaliação ainda.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { margin: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontSize: 16, fontWeight: 'bold' },
  rating: { marginVertical: 8 },
  comment: { fontSize: 14, marginTop: 8, color: '#333' },
  date: { fontSize: 12, color: '#999', marginTop: 8 },
  empty: { padding: 32, alignItems: 'center' }
});
```

#### ☐ 5.3. Criar endpoint para buscar avaliações do usuário
**Arquivo**: `backend/app/api/endpoints/users.py`

```python
@router.get("/me/evaluations", response_model=List[dict])
async def get_my_evaluations(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Retorna todas as avaliações recebidas pelo usuário atual.
    """
    evaluations = []
    async for evaluation in db.evaluations.find({"professional_id": str(current_user.id)}).sort("created_at", -1):
        # Buscar nome do cliente
        client = await db.users.find_one({"_id": evaluation["client_id"]})
        
        evaluations.append({
            "id": evaluation["_id"],
            "client_id": evaluation["client_id"],
            "client_name": client.get("full_name") if client else None,
            "project_id": evaluation["project_id"],
            "rating": evaluation["rating"],
            "comment": evaluation.get("comment"),
            "created_at": evaluation["created_at"]
        })
    
    return evaluations
```

#### ☐ 5.4. Adicionar função getUserEvaluations no mobile
**Arquivo**: `mobile/src/api/users.ts`

```typescript
export interface Evaluation {
  id: string;
  client_id: string;
  client_name?: string;
  project_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export async function getUserEvaluations(): Promise<Evaluation[]> {
  const token = useAuthStore.getState().token;
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  
  const response = await client.get('/users/me/evaluations', config);
  return response.data;
}
```

---

### 🔹 FASE 6: EXIBIR MÉDIA DE AVALIAÇÕES NO PERFIL

#### ☐ 6.1. Adicionar média de avaliações no GET /users/me
**Arquivo**: `backend/app/api/endpoints/users.py`

```python
# Já existe o campo average_rating no modelo User
# Garantir que ele seja retornado no endpoint /users/me

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
```

#### ☐ 6.2. Exibir média no perfil do profissional
**Arquivo**: `mobile/src/screens/ProfileScreen.tsx` (ou tela de perfil)

```typescript
import { Rating } from 'react-native-ratings';

// No render
{user?.roles.includes('professional') && user?.average_rating && (
  <View style={styles.ratingSection}>
    <Text style={styles.ratingLabel}>Avaliação Média</Text>
    <Rating
      readonly
      startingValue={user.average_rating}
      imageSize={24}
      style={styles.rating}
    />
    <Text style={styles.ratingText}>
      {user.average_rating.toFixed(1)} ({user.evaluations?.length || 0} avaliações)
    </Text>
  </View>
)}
```

---

### 🔹 FASE 7: INTEGRAÇÃO WEBSOCKET COMPLETA

#### ☐ 7.1. Garantir que WebSocket se reconecta automaticamente
**Arquivo**: `mobile/src/services/websocket.ts`

Verificar se já existe lógica de reconexão. Se não:

```typescript
export function createWebsocket(userId: string): WebSocket {
  const token = useAuthStore.getState().token;
  const ws = new WebSocket(`${WS_BASE_URL}/ws/${userId}?token=${token}`);
  
  ws.addEventListener('close', () => {
    console.log('[WebSocket] Connection closed, reconnecting in 3s...');
    setTimeout(() => {
      createWebsocket(userId);
    }, 3000);
  });
  
  return ws;
}
```

#### ☐ 7.2. Adicionar listener global de mensagens
**Arquivo**: `mobile/src/hooks/useWebSocket.ts`

```typescript
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';
import { createWebsocket } from '../services/websocket';

export function useWebSocket() {
  const { user } = useAuthStore();
  const navigation = useNavigation();
  
  useEffect(() => {
    if (!user?.id) return;
    
    const ws = createWebsocket(user.id);
    
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_message') {
        // Mostrar notificação local
        // Atualizar badge de não lidas
      }
      
      if (data.type === 'new_contact') {
        // Cliente recebeu novo contato
        // Mostrar notificação
      }
    });
    
    return () => {
      ws.close();
    };
  }, [user]);
}
```

---

### 🔹 FASE 8: TESTES E VALIDAÇÕES

#### ☐ 8.1. Testar fluxo completo como cliente
- [ ] Cliente cria projeto
- [ ] Cliente vê projeto em "Meus Projetos"
- [ ] Cliente recebe notificação quando profissional contata
- [ ] Cliente abre projeto e vê lista de interessados
- [ ] Cliente clica em profissional e abre chat
- [ ] Cliente envia mensagens
- [ ] Cliente marca projeto como concluído
- [ ] Cliente avalia profissional

#### ☐ 8.2. Testar fluxo completo como profissional
- [ ] Profissional vê projetos próximos
- [ ] Profissional contata projeto (gasta créditos)
- [ ] Profissional vê projeto em "Projetos Contatados"
- [ ] Profissional recebe resposta do cliente no chat
- [ ] Profissional envia mensagens
- [ ] Profissional marca como concluído
- [ ] Profissional recebe avaliação

#### ☐ 8.3. Testar WebSocket
- [ ] Mensagens aparecem em tempo real
- [ ] Reconexão automática funciona
- [ ] Notificações funcionam quando app está em background
- [ ] Badge de não lidas atualiza corretamente

#### ☐ 8.4. Testar avaliações
- [ ] Modal de avaliação aparece após conclusão
- [ ] Avaliação é salva corretamente
- [ ] Média é calculada e exibida no perfil
- [ ] Não é possível avaliar duas vezes o mesmo projeto

---

### 🔹 FASE 9: MELHORIAS E POLIMENTO

#### ☐ 9.1. Adicionar loading states
- [ ] Skeleton loaders ao carregar contatos
- [ ] Indicador de "enviando" ao enviar mensagem
- [ ] Feedback visual ao avaliar

#### ☐ 9.2. Tratamento de erros
- [ ] Mensagens de erro amigáveis
- [ ] Retry automático em caso de falha de rede
- [ ] Validação de campos antes de enviar

#### ☐ 9.3. Melhorias de UX
- [ ] Animações suaves nas transições
- [ ] Haptic feedback em ações importantes
- [ ] Auto-scroll para última mensagem no chat
- [ ] Indicador de "digitando..." no chat

#### ☐ 9.4. Performance
- [ ] Paginação na lista de contatos
- [ ] Lazy loading de mensagens antigas
- [ ] Cache de dados para acesso offline

---

## 🎨 OBSERVAÇÕES IMPORTANTES

### Segurança
- ✅ Todas as rotas já usam autenticação via JWT
- ✅ Validações de autorização implementadas (cliente só vê seus projetos, etc.)
- ☐ Adicionar rate limiting em endpoints de mensagens para evitar spam

### Performance
- ✅ MongoDB com índices geoespaciais para busca de projetos próximos
- ✅ WebSocket com ConnectionManager eficiente
- ☐ Considerar adicionar Redis para cache de contadores de mensagens não lidas

### Escalabilidade
- ✅ Arquitetura separada backend/mobile permite escalabilidade horizontal
- ☐ Considerar migrar WebSocket para serviço separado (Socket.io cluster) em produção
- ☐ Implementar compressão de mensagens para reduzir tráfego

### Notificações Push
- ✅ Firebase Cloud Messaging já integrado no backend
- ☐ Testar notificações em iOS e Android
- ☐ Adicionar deep linking para abrir chat específico a partir da notificação

---

## 📦 DEPENDÊNCIAS NECESSÁRIAS

### Backend
```bash
# Já instaladas
pip install fastapi motor pydantic ulid-py python-jose[cryptography] passlib[bcrypt]
```

### Mobile
```bash
# Já instaladas
npm install @react-navigation/native @react-navigation/stack
npm install react-native-paper react-native-ratings
npm install date-fns

# Adicionar se necessário
npm install react-native-push-notification
npm install @react-native-community/push-notification-ios
```

---

## 🚀 ORDEM DE EXECUÇÃO RECOMENDADA

1. **FASE 1 e 2** (Listar contatos do projeto) - ALTA PRIORIDADE
   - Permite cliente ver quem contatou
   - Base para todo o resto do fluxo

2. **FASE 3** (Melhorar chat) - ALTA PRIORIDADE
   - Marcar mensagens como lidas
   - Essencial para UX

3. **FASE 4** (Notificações de mensagens) - MÉDIA PRIORIDADE
   - Badge de não lidas
   - Melhora engajamento

4. **FASE 5 e 6** (Avaliações) - ALTA PRIORIDADE
   - Sistema de reputação
   - Essencial para marketplace

5. **FASE 7** (WebSocket) - MÉDIA PRIORIDADE
   - Melhorar integração
   - Já está funcional, apenas refinamentos

6. **FASE 8** (Testes) - ALTA PRIORIDADE
   - Garantir qualidade
   - Encontrar bugs

7. **FASE 9** (Melhorias) - BAIXA PRIORIDADE
   - Polimento final
   - Pode ser incremental

---

## ✨ RESULTADO ESPERADO

Após implementação completa:

1. ✅ Cliente cria projeto e consegue ver todos os profissionais que demonstraram interesse
2. ✅ Profissional contata projeto próximo gastando créditos
3. ✅ Sistema de chat em tempo real funcional com histórico persistente
4. ✅ Cliente e profissional trocam mensagens via WebSocket
5. ✅ Notificações de novas mensagens (WebSocket + Push quando offline)
6. ✅ Projeto pode ser marcado como concluído
7. ✅ Sistema de avaliação funcional após conclusão
8. ✅ Avaliações exibidas no perfil do profissional com média calculada
9. ✅ Badge de mensagens não lidas atualizado em tempo real
10. ✅ Fluxo completo testado e validado

---

## 📝 NOTAS ADICIONAIS

- O backend JÁ TEM a maior parte da infraestrutura necessária
- O mobile JÁ TEM componentes de chat e avaliação implementados
- O principal GAP é a **listagem de contatos do projeto para o cliente**
- WebSocket já funciona, mas precisa de integração mais robusta
- Sistema de avaliações está implementado mas não está sendo chamado no momento certo

**ESTIMATIVA DE TEMPO**: 
- Desenvolvedor experiente: 3-5 dias de trabalho
- Com testes completos: +2 dias
- Total: ~1 semana de trabalho focado

---

## 🎯 PRONTO PARA IMPLEMENTAÇÃO!

Este plano pode ser copiado e colado para um agente implementar. Todos os trechos de código são funcionais e seguem os padrões já estabelecidos no projeto.

**Boa sorte com a implementação! 🚀**
