# Plano de Melhorias para a Tela de Boas-Vindas do Cliente (WelcomeCustomerScreen)

Este documento detalha as tarefas para aprimorar a `WelcomeCustomerScreen`, transformando-a em um hub central e eficiente para os clientes encontrarem e contratarem serviços.

## Checklist de Implementação

### Fase 1: Elementos Essenciais

- [ ] **1. Barra de Busca Inteligente (com Sugestões em Tempo Real)**
  - **Objetivo:** Permitir que o usuário encontre serviços rapidamente, digitando o que precisa. A busca atual é local e limitada.
  - **Frontend (`WelcomeCustomerScreen.tsx`):**
    - Modificar o `TextInput` para que, ao digitar, ele chame um novo endpoint no backend (`/search/suggestions`).
    - Exibir os resultados (sugestões de categorias/subcategorias) em uma lista suspensa abaixo da barra de busca.
    - Ao selecionar uma sugestão ou pressionar "Buscar", navegar para a tela de resultados.
  - **Backend (`/api/endpoints/search.py` - novo):**
    - Criar um endpoint `GET /search/suggestions` que recebe um parâmetro de busca `q`.
    - O endpoint deve buscar em `Categories`, `Subcategories` e `tags` por termos correspondentes.
    - Retornar uma lista ordenada por relevância.

- [ ] **2. Navegação Visual por Categorias Principais**
  - **Objetivo:** Oferecer uma forma de exploração para usuários que não sabem exatamente o que procurar.
  - **Frontend (`WelcomeCustomerScreen.tsx`):**
    - Criar um novo componente, `CategoryGrid.tsx`.
    - Na `WelcomeCustomerScreen`, abaixo da busca, renderizar o `CategoryGrid`.
    - O componente deve buscar as categorias principais do endpoint `GET /categories`.
    - Exibir cada categoria com um ícone e nome. O clique deve levar à tela de resultados daquela categoria.
  - **Backend (`/api/endpoints/categories.py`):**
    - Garantir que exista um endpoint `GET /categories` que retorne a lista de categorias principais (sem as subcategorias, para ser mais leve).

- [ ] **3. Atalho para "Meus Pedidos"**
  - **Objetivo:** Facilitar o acesso de clientes recorrentes ao status de seus projetos.
  - **Frontend:**
    - Adicionar um item na navegação principal (seja um `TabBar` inferior ou um botão no cabeçalho) chamado "Meus Pedidos".
    - Criar uma nova tela `MyOrdersScreen.tsx`.
    - Essa tela deve buscar e listar os projetos do cliente a partir do endpoint `GET /projects/customer/me`.
  - **Backend (`/api/endpoints/projects.py`):**
    - Criar (ou verificar se existe) um endpoint `GET /projects/customer/me` que retorna os projetos associados ao `client_id` do usuário autenticado.

- [ ] **4. Acesso Rápido ao Perfil e Notificações**
  - **Objetivo:** Dar ao usuário controle sobre sua conta e mantê-lo informado.
  - **Frontend (`WelcomeCustomerScreen.tsx`):**
    - No cabeçalho, ao lado do `LocationAvatar`, adicionar um ícone de "sino" para notificações.
    - O `LocationAvatar` pode ser transformado em um botão que navega para a tela de `ProfileScreen`.
    - O ícone de sino deve navegar para uma futura `NotificationsScreen`.

### Fase 2: Aprimoramentos e Engajamento

- [ ] **5. Seção "Profissionais Perto de Você"**
  - **Objetivo:** Aumentar a conversão para serviços locais, mostrando profissionais próximos e disponíveis.
  - **Frontend (`WelcomeCustomerScreen.tsx`):**
    - Criar um novo componente `NearbyProfessionalsCarousel.tsx`.
    - O componente deve solicitar permissão de localização. Se concedida, usar as coordenadas para chamar o endpoint `GET /users/professionals/nearby`.
    - Renderizar um carrossel horizontal com o avatar, nome e avaliação dos profissionais.
    - Cada item do carrossel deve ser clicável, levando ao perfil completo do profissional.
  - **Backend (`/api/endpoints/users.py`):**
    - O endpoint `GET /users/professionals/nearby` já parece existir (conforme `backend/README.md`). Verificar se ele está otimizado para essa finalidade.

- [ ] **6. Banner Promocional (Carrossel de Imagens)**
  - **Objetivo:** Ferramenta de marketing para destacar promoções, novas categorias ou funcionalidades.
  - **Frontend (`WelcomeCustomerScreen.tsx`):**
    - O componente `BannerAd` e o hook `useAd` já existem e são perfeitos para isso.
    - A implementação atual já busca por `banner_client`. O trabalho aqui é garantir que o backend possa servir múltiplas imagens e que o `BannerAd` as renderize como um carrossel.
    - **Ação:** Modificar o componente `BannerAd.tsx` para, caso `useAd` retorne um array de `images`, renderizar um carrossel (usando `FlatList` horizontal ou uma lib como `react-native-snap-carousel`).
  - **Backend (`/api/endpoints/ads.py`):**
    - O endpoint `mobile_get_ad` já parece capaz de retornar uma lista de imagens (`"type": "image"`).
    - O admin precisa de uma forma de fazer upload de múltiplas imagens para o `location` `banner_client_home` e associar links a elas. A funcionalidade `admin_set_image_meta` já existe e pode ser usada para isso.

- [ ] **7. Seção "Continue de Onde Parou"**
  - **Objetivo:** Reengajar usuários que iniciaram uma busca mas não a concluíram.
  - **Frontend:**
    - Utilizar `AsyncStorage` para salvar as últimas 3-5 buscas de subcategorias ou perfis de profissionais visitados.
    - Na `WelcomeCustomerScreen`, ler esse histórico e, se houver dados, exibir uma seção com atalhos para essas buscas/perfis.
  - **Backend:** Nenhuma alteração necessária para uma implementação inicial.

- [ ] **8. Conteúdo Inspiracional (Blog/Dicas)**
  - **Objetivo:** Posicionar a plataforma como especialista e ajudar os clientes a tomar melhores decisões.
  - **Frontend:**
    - Criar uma seção "Dicas para seu projeto" na `WelcomeCustomerScreen`.
    - Essa seção buscaria os artigos mais recentes de um novo endpoint.
    - Exibiria uma lista de artigos com título e imagem. O clique levaria a uma tela de leitura do artigo (pode ser uma `WebView` ou uma tela nativa).
  - **Backend:**
    - Criar um novo `router` para conteúdo, ex: `articles.py`.
    - Definir um novo modelo Pydantic `Article`.
    - Implementar endpoints CRUD para gerenciar os artigos (inicialmente, apenas `GET /articles/public` seria suficiente para o app).

---

### Estrutura Visual Proposta para `WelcomeCustomerScreen.tsx`

```
<SafeAreaView>
  <ScrollView>
    {/* 1. Cabeçalho com Perfil e Notificações */}
    <Header />

    {/* 2. Barra de Busca Inteligente */}
    <SmartSearchBar />

    {/* 3. Navegação por Categorias */}
    <CategoryGrid />

    {/* 4. Banner Promocional */}
    <BannerAd adType="banner_client_home" />

    {/* 5. Profissionais Perto de Você */}
    <NearbyProfessionalsCarousel />

    {/* 6. Conteúdo Inspiracional */}
    <InspirationalContent />

  </ScrollView>

  {/* 7. Navegação Principal (com "Meus Pedidos") */}
  <BottomTabBar />
</SafeAreaView>
```