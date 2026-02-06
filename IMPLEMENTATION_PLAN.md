# Plano de Implementação: Consolidar Contacts e Chats em Projects

Com base na decisão de manter "contacts" como array interno em "projects" (sem migração, assumindo exclusão das entidades separadas), aqui está um plano passo a passo para resolver dependências no backend e frontend. O foco é integrar "contacts" (com campos como `contact_type`, `contact_details`, etc.) e "chats" (como array de mensagens) diretamente em cada documento de projeto.

## 1. Backend (Node.js/Express + MongoDB)
- **Atualizar Schema/Model de Project**:
  - Modifique o modelo `Project` (ex.: em `models/Project.js`) para incluir `contacts` como array de objetos. Cada objeto terá campos de contato + `chats` como array.
  - Exemplo de schema (usando Mongoose):
    ```javascript
    // filepath: /path/to/models/Project.js
    const projectSchema = new mongoose.Schema({
      // ... campos existentes (title, description, etc.) ...
      contacts: [{
        contact_type: { type: String, required: true },
        contact_details: { type: Object },
        professional_id: { type: String },
        client_id: { type: String },
        credits_used: { type: Number },
        status: { type: String },
        professional_name: { type: String },
        client_name: { type: String },
        chats: [{
          sender_id: { type: String },
          message: { type: String },
          timestamp: { type: Date, default: Date.now }
        }]
      }]
    });
    ```
  - Remova modelos separados para `Contact` e `Chat`.

- **Ajustar APIs**:
  - **Criação/Atualização de Projetos**: Modifique endpoints como `POST /projects` e `PUT /projects/:id` para aceitar `contacts` no body. Ex.: ao criar um contato, adicione-o ao array `contacts` do projeto.
  - **Busca de Projetos Contactados**: Atualize `getContactedProjects` (ex.: em `routes/professional.js`) para filtrar projetos onde `contacts` não está vazio e retornar apenas projetos relevantes.
  - **Gerenciamento de Chats**: Crie/adapte endpoints para adicionar mensagens a `contacts[index].chats` (ex.: `POST /projects/:id/contacts/:contactIndex/chats`).
  - **Exclusão**: Remova endpoints antigos para `contacts` e `chats`. Atualize qualquer lógica que dependa deles para usar o novo schema.
  - Teste: Verifique se queries como `Project.find({ 'contacts.status': 'pending' })` funcionam.

- **Dependências Resolvidas**:
  - Todas as operações de contato/chat agora passam por `/projects`.
  - Remova imports/referências a modelos `Contact` e `Chat`.

## 2. Frontend (React Native)
- **Atualizar API Calls**:
  - No arquivo `api/professional.js` (ou similar), ajuste `getContactedProjects` para esperar projetos com `contacts` aninhado. Ex.: a resposta já incluirá `item.contacts`.
  - Adicione funções para interagir com chats, ex.: `addMessageToContact(projectId, contactIndex, message)`.

- **Modificar Componentes**:
  - **ContactedProjectsScreen.tsx**: Mude o `renderItem` para usar `ProjectContactedCard` em vez de `JSON.stringify`. Passe `item` (projeto) para o componente.
    ```tsx
    // filepath: /home/claus/src/agapp/mobile/src/screens/ContactedProjectsScreen.tsx
    // ...existing code...
    renderItem={({ item }) => (
      <ProjectContactedCard project={item} />
    )}
    // ...existing code...
    ```
  - **ProjectContactedCard.tsx**: Atualize para acessar `fullProject.contacts` (em vez de dados separados). Ex.: renderize uma lista de contatos e chats.
    ```tsx
    // filepath: /home/claus/src/agapp/mobile/src/components/ProjectContatedCard.tsx
    // ...existing code...
    return (
      <View>
        {fullProject?.contacts?.map((contact, index) => (
          <View key={index}>
            <Text>{contact.contact_type}</Text>
            <Text>{contact.contact_details?.message}</Text>
            {/* Renderizar chats */}
            {contact.chats?.map((chat, chatIndex) => (
              <Text key={chatIndex}>{chat.message}</Text>
            ))}
          </View>
        ))}
      </View>
    );
    // ...existing code...
    ```

- **Dependências Resolvidas**:
  - Remova imports/referências a APIs separadas para `contacts` e `chats`.
  - Teste navegação e renderização para garantir que contatos e chats apareçam corretamente.

## 3. Passos Gerais de Implementação
- **Ordem**: Comece pelo backend (schema e APIs), depois frontend.
- **Testes**: Execute o app, crie um projeto com contatos/chats e verifique se `ContactedProjectsScreen` carrega corretamente.
- **Limpeza**: Após implementação, remova arquivos/códigos obsoletos relacionados a entidades separadas.
- **Tempo Estimado**: 4-6 horas para backend + 2-4 horas para frontend, dependendo da complexidade.

## 4. Funcionalidade Adicional: Liberar Projeto para Profissional
- **Descrição**: Quando um profissional cria um contato (demonstra interesse) em um projeto, adicionar seu `professional_id` ao array `liberado_por` do projeto, se ainda não estiver presente. Isso permite rastrear quais profissionais "liberaram" ou demonstraram interesse no projeto.
- **Implementação Backend**:
  - Modificar `create_contact_in_project` em `crud/project.py` para adicionar `professional_id` ao `liberado_por` usando `$addToSet` para evitar duplicatas.
  - Exemplo: `await db.projects.update_one({"_id": project_id}, {"$addToSet": {"liberado_por": professional_id}})`
- **Frontend**: Nenhuma mudança necessária, pois é automático no backend.
- **Testes**: Verificar se ao criar contato, o `liberado_por` é atualizado no projeto.

## 5. Melhorias no Contact
- **User Completo do Profissional**: Incluir `professional_user` (objeto completo do user) no contact para acesso rápido a todas as informações do profissional.
- **Fallback de Busca**: Criar entidade separada `ProfessionalLiberation` com {professional_id, project_id, created_at} para busca rápida de projetos "liberados" por profissional, evitando inflar o documento `User`.
- **Implementação**:
  - Criar modelo `ProfessionalLiberation` em `models/professional_liberation.py`.
  - Em `create_contact_in_project`, inserir documento na coleção `professional_liberations`.
  - Para busca: Query `db.professional_liberations.find({"professional_id": user_id})` para obter project_ids.
- **Benefícios**: Acesso rápido a dados do profissional e busca eficiente sem crescimento excessivo de documentos.