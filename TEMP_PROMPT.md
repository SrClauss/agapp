# Startup da aplicação

1. **Listar Webhooks Existentes**:
   - No início da aplicação, faça uma requisição para o endpoint do Asaas que lista os webhooks existentes.
   - Utilize o token de autenticação do Asaas, garantindo que o token seja precedido pelo caractere `$` (respeitando o formato).

2. **Verificar Webhook 'Pagamento Confirmado'**:
   - Analise a resposta da requisição para verificar se já existe um webhook com o nome **'Pagamento Confirmado'**.

3. **Criar Webhook Caso Não Exista**:
   - Caso o webhook **'Pagamento Confirmado'** não esteja presente na lista, crie um novo webhook com as seguintes características:
     - Nome: **'Pagamento Confirmado'**.
     - Evento monitorado: **`PAYMENT_CONFIRMED`**.
     - URL: **`https://agilizapro.net/webhook/asaas`**.
     - Token de autenticação: Utilize o valor da variável de ambiente **`ASAAS_WEBHOOK_TOKEN`**.

4. **Implementação da Rota**:
   - Crie uma rota na aplicação que permita a criação do webhook caso necessário.
   - A rota deve receber os dados necessários e realizar a chamada ao endpoint do Asaas para criar o webhook.

5. **Exemplo de Fluxo**:
   - No startup:
     ```python
     # Pseudo-código para ilustrar o fluxo
     response = listar_webhooks()
     if not webhook_existe(response, 'Pagamento Confirmado'):
         criar_webhook('Pagamento Confirmado', 'PAYMENT_CONFIRMED', 'https://agilizapro.net/webhook/asaas', os.getenv('ASAAS_WEBHOOK_TOKEN'))
     ```

---

**Objetivo:** Controlar as stacks de navegação para evitar acúmulo indevido.

- Ao navegar de volta para qualquer *welcome screen*, todas as stacks de navegação associadas devem ser resetadas (limpas) para evitar que telas anteriores se acumulem.
- Garantir que, ao reentrar nas telas de boas-vindas, a navegação comece em um estado “limpo”, sem histórico residual.

---

**Objetivo:** Implementar fases de status de projeto e permitir fechar projeto com profissional e orçamento.

- Fluxo de projeto:
  1. Cliente posta o projeto.
  2. Profissional entra em contato (chat/proposta).
  3. Cliente marca o projeto como **fechado com um profissional específico**, registrando:
     - profissional escolhido
     - orçamento/valor acordado
  4. Quando o projeto estiver pronto, o cliente poderá avaliar o profissional (mantendo o fluxo de avaliação já existente).

---

**Objetivo:** Criar uma coleção separada para avaliações do cliente (cliente avaliando profissional) para permitir que, posteriormente, o profissional também avalie o cliente.

- Deve haver uma entidade independente (coleção) chamada algo como **`client_evaluations`** ou similar.
- Essa coleção deve registrar pelo menos:
  - `client_id` (quem avalia)
  - `professional_id` (quem está sendo avaliado)
  - `project_id` (projeto associado)
  - `rating` (1-5)
  - `comment` (opcional)
  - `created_at`
- A separação garante que o fluxo de avaliação do cliente/profissional fique desacoplado da avaliação do profissional pelo cliente.

---

**Objetivo:** Criar rotas que retornem avaliações pelo ID de usuário (profissional ou cliente).

- Deve haver pelo menos uma rota (ou um conjunto de rotas) que permita:
  - Buscar avaliações feitas **pelo cliente** (para profissionais), filtrando por `client_id`.
  - Buscar avaliações recebidas **pelo profissional**, filtrando por `professional_id`.
  - Buscar avaliações feitas **pelo profissional** (avaliando cliente), filtrando por `professional_id`.
  - Buscar avaliações recebidas **pelo cliente**, filtrando por `client_id`.
- As rotas devem aceitar IDs de usuário e retornar resultados paginados/resumidos conforme necessário.

---

**Objetivo:** Impedir que usuários liberem projetos criados por eles mesmos.

- Deve ser implementada uma lógica que verifique se o `user_id` do usuário atual é o mesmo que o `creator_id` do projeto.
- Caso o `user_id` seja igual ao `creator_id`, a ação de liberar o projeto deve ser bloqueada e uma mensagem de erro apropriada deve ser retornada.
- Essa validação deve ser aplicada em todas as rotas ou ações relacionadas à liberação de projetos.

---

**Objetivo:** Restringir o acesso aos chats com base no papel ativo do usuário (cliente ou profissional).

- Um **profissional** não pode acessar o chat de um projeto que ele mesmo criou como cliente.
- Um **cliente** não pode acessar o chat de um projeto que ele pegou para trabalhar como profissional.
- A lógica deve ser implementada tanto no backend quanto no frontend:
  - **Backend**:
    - Atualizar os endpoints de contatos para verificar o papel ativo do usuário.
    - Bloquear o acesso a contatos onde o `user_id` do usuário atual coincide com o `creator_id` do projeto e o papel ativo não corresponde ao esperado.
  - **Frontend**:
    - Garantir que a lista de chats exibida na tela (`ChatListScreen.tsx`) seja filtrada com base no papel ativo do usuário.
    - No modal de chat (`ChatModal.tsx`), exibir apenas informações relevantes ao papel ativo do usuário.
- Essa separação garante que as interações de um usuário como cliente ou profissional sejam isoladas e exibidas apenas no contexto apropriado.

---

# Tela de Compra de Créditos

1. **Botão 'Comprar Créditos'**:
   - Ao pressionar o botão 'Comprar Créditos', o usuário deve ser direcionado para uma nova tela (stack) onde poderá escolher entre os pacotes de créditos disponíveis.

2. **Exibição de Pacotes Disponíveis**:
   - A tela deve listar todos os pacotes de créditos disponíveis (credits_packages).
   - Cada pacote deve exibir informações como:
     - Nome do pacote.
     - Quantidade de créditos.
     - Preço.
     - Descrição (se aplicável).
   - O usuário pode selecionar um pacote para prosseguir.

3. **Fluxo de Pagamento**:
   - Após selecionar um pacote, o usuário deve ser redirecionado para uma WebView ou navegador externo.
   - A WebView ou navegador deve carregar o checkout do Asaas correspondente ao pacote selecionado.

4. **Exemplo de Fluxo**:
   - O botão 'Comprar Créditos' abre uma nova tela com a lista de pacotes:
     ```javascript
     // Exemplo de pseudo-código para exibir os pacotes
     const pacotes = [
       { id: '123', nome: 'Pacote Básico', preco: 50 },
       { id: '124', nome: 'Pacote Premium', preco: 100 }
     ];
     exibirTelaPacotes(pacotes);
     ```
   - Ao selecionar um pacote, o checkout é aberto:
     ```javascript
     abrirWebView(`https://www.asaas.com/checkout/${pacoteSelecionado.id}`);
     ```

5. **Considerações**:
   - Por enquanto, não abordar assinaturas.
   - Garantir que a experiência do usuário seja fluida e intuitiva.
