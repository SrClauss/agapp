# Prompt de Implementação: Sistema de Ads

## Contexto Geral

Implemente um sistema completo de anúncios (ads) para uma aplicação composta por:
- **Backend**: Python/FastAPI com MongoDB
- **Mobile**: React Native
- **Painel Administrativo**: Web (já existente, adicionar funcionalidades de ads)

O sistema possui **dois componentes principais**: **Banner** e **Ad Screen**.

---

## 1. Componente Banner

### 1.1 Definição
Um **Banner** é uma entidade que representa uma **única imagem** com propriedades e ações próprias. Múltiplos banners são exibidos em um **carrossel** no aplicativo mobile.

### 1.2 Propriedades do Banner

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `_id` | string | ID único (ULID) |
| `target` | enum | Alvo do banner: `cliente` ou `profissional` |
| `image_base64` | string | Imagem em formato Base64 |
| `filename` | string | Nome original do arquivo |
| `mime_type` | string | Tipo MIME (ex: `image/jpeg`) |
| `size` | int | Tamanho em bytes |
| `order` | int | Ordem de exibição no carrossel |
| `version` | int | Versão do banner (incrementa a cada alteração) |
| `is_active` | bool | Se o banner está ativo |
| `action` | object | Ação ao clicar no banner |
| `created_at` | datetime | Data de criação |
| `updated_at` | datetime | Data da última atualização |
| `created_by` | string | ID do usuário que criou |
| `updated_by` | string | ID do usuário que atualizou |

### 1.3 Estrutura da Ação do Banner

```json
{
  "action_type": "none" | "link" | "stack",
  "action_value": "<URL externa ou nome da stack>"
}
```

### 1.4 Validação de Imagem

- **Proporção obrigatória**: Largura = 3x Altura (ex: 1024x290, 900x300)
- **Tolerância**: Permitir pequena variação (±10%)
- **Erro**: Retornar HTTP 400 se a imagem estiver fora do padrão
- **Validador existente**: Manter o validador atual que rejeita imagens fora do padrão

### 1.5 Stacks Predefinidas por Target

As stacks de navegação devem ser predefinidas em um **seletor** para evitar erros de configuração.

#### Stacks para Target `cliente`:
| Stack | Descrição |
|-------|-----------|
| `WelcomeCustomer` | Tela de boas-vindas do cliente |
| `SearchResults` | Resultados de busca |
| `CreateProject` | Criar novo projeto |
| `AllProjects` | Todos os projetos |
| `Support` | Suporte |

#### Stacks para Target `profissional`:
| Stack | Descrição |
|-------|-----------|
| `WelcomeProfessional` | Tela de boas-vindas do profissional |
| `ProjectsList` | Lista de projetos disponíveis |
| `Credits` | Meus créditos |
| `CreditPackages` | Comprar créditos |
| `Subscriptions` | Assinaturas |
| `Support` | Suporte |

**Regra crítica**: O seletor deve impedir que um banner de `cliente` navegue para stacks de `profissional` e vice-versa.

### 1.6 Gerenciamento no Painel Administrativo

- **Listar**: Visualizar todos os banners por target
- **Criar**: Upload de imagem com validação de proporção
- **Editar**: Alterar ação, ordem, status (ativo/inativo)
- **Excluir**: Remover banner
- **Preview**: Visualizar imagem antes de salvar
- **Seletor de Ação**: Dropdown com opções:
  - "Nenhuma ação"
  - "Link externo" (input de URL)
  - "Navegação interna" (select com stacks do target)

### 1.7 Otimização no Mobile

#### Fluxo de Verificação de Versão:
1. App consulta endpoint leve: `GET /api/v1/ads/banners/{target}/version`
   - Retorna apenas: `{ "version": 5, "count": 3 }`
2. App compara com versão local no AsyncStorage
3. **Se versão diferente**: Consulta endpoint completo com imagens Base64
4. **Se versão igual**: Usa imagens do storage local

#### Storage Local:
- Armazenar imagens Base64 no AsyncStorage/MMKV
- Chave: `banners_{target}_v{version}`

---

## 2. Componente Ad Screen

### 2.1 Definição
Um **Ad Screen** é uma **página web completa** (HTML/CSS/JS) exibida em tela cheia no aplicativo mobile via WebView.

### 2.2 Propriedades do Ad Screen

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `_id` | string | ID único (ULID) |
| `target` | enum | Alvo: `cliente` ou `profissional` |
| `name` | string | Nome identificador |
| `version` | int | Versão (incrementa a cada upload) |
| `is_active` | bool | Se está ativo |
| `file_data` | binary | Arquivo .zip ou .tar.gz em Base64 |
| `file_type` | string | `zip` ou `tar.gz` |
| `created_at` | datetime | Data de criação |
| `updated_at` | datetime | Data da última atualização |
| `created_by` | string | ID do usuário que criou |
| `updated_by` | string | ID do usuário que atualizou |

### 2.3 Inclusão no Sistema

- **Upload**: Aceitar arquivos `.zip` ou `.tar.gz`
- **Estrutura esperada**: O arquivo deve conter `index.html` na raiz
- **Validação**: Verificar se `index.html` existe no arquivo enviado

### 2.4 Comunicação WebView ↔ Mobile

O Ad Screen comunica com o app React Native via `ReactNativeWebView.postMessage()`.

#### Mensagem de Ação (botão principal):
```javascript
// Navegação para stack interna
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'press',
  action: {
    onPress_type: 'stack',
    onPress_stack: 'ProjectsList'
  }
}));

// Navegação para link externo
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'press',
  action: {
    onPress_type: 'link',
    onPress_link: 'https://exemplo.com'
  }
}));
```

#### Mensagem de Fechar:
```javascript
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'close',
  action: {
    onClose_stack: 'WelcomeCustomer' // ou 'WelcomeProfessional'
  }
}));
```

### 2.5 Gerenciamento no Painel Administrativo

- **Listar**: Visualizar todos os ad_screens por target
- **Criar**: Upload de arquivo .zip/.tar.gz
- **Editar**: Substituir arquivo, alterar status
- **Excluir**: Remover ad_screen
- **Preview**: Renderizar o `index.html` em um iframe para visualização

### 2.6 Otimização no Mobile

#### Fluxo de Verificação de Versão:
1. App consulta endpoint leve: `GET /api/v1/ads/ad-screens/{target}/version`
   - Retorna apenas: `{ "version": 2 }`
2. App compara com versão local
3. **Se versão diferente**: Download do arquivo .zip e extração no FileSystem
4. **Se versão igual**: Usa arquivos do storage local

#### Storage Local:
- Extrair arquivos para: `FileSystem.documentDirectory/ad_screens/{target}/`
- Carregar WebView com URI local: `file://...ad_screens/{target}/index.html`

---

## 3. Endpoints da API

### 3.1 Banner

```
# Admin
POST   /api/v1/admin/ads/banners                  # Criar banner
GET    /api/v1/admin/ads/banners                  # Listar todos
GET    /api/v1/admin/ads/banners/{id}             # Obter por ID
PUT    /api/v1/admin/ads/banners/{id}             # Atualizar
DELETE /api/v1/admin/ads/banners/{id}             # Remover
GET    /api/v1/admin/ads/stacks/{target}          # Listar stacks disponíveis

# Mobile
GET    /api/v1/ads/banners/{target}/version       # Verificar versão (leve)
GET    /api/v1/ads/banners/{target}               # Obter banners com imagens
```

### 3.2 Ad Screen

```
# Admin
POST   /api/v1/admin/ads/ad-screens               # Upload ad_screen
GET    /api/v1/admin/ads/ad-screens               # Listar todos
GET    /api/v1/admin/ads/ad-screens/{id}          # Obter por ID
PUT    /api/v1/admin/ads/ad-screens/{id}          # Atualizar
DELETE /api/v1/admin/ads/ad-screens/{id}          # Remover
GET    /api/v1/admin/ads/ad-screens/{id}/preview  # Preview HTML

# Mobile
GET    /api/v1/ads/ad-screens/{target}/version    # Verificar versão (leve)
GET    /api/v1/ads/ad-screens/{target}/download   # Download arquivo .zip
```

---

## 4. Estrutura de Arquivos

### Backend
```
backend/app/
├── api/endpoints/
│   └── ads.py                    # Endpoints de ads
├── crud/
│   ├── banner.py                 # CRUD de banners
│   └── ad_screen.py              # CRUD de ad_screens
├── models/
│   ├── banner.py                 # Modelo Banner
│   └── ad_screen.py              # Modelo AdScreen
├── schemas/
│   └── ads.py                    # Schemas Pydantic
└── services/
    └── ads_service.py            # Lógica de negócio
```

### Mobile
```
mobile/src/
├── screens/
│   └── AdScreen.tsx              # Tela WebView para ad_screen
├── components/
│   └── BannerCarousel.tsx        # Carrossel de banners
├── services/
│   └── adsService.ts             # Serviço de ads (API + storage)
└── stores/
    └── adsStore.ts               # Estado global de ads
```

---

## 5. Requisitos de Implementação

### 5.1 Backend
- [ ] Criar models para Banner e AdScreen
- [ ] Criar schemas Pydantic com validações
- [ ] Implementar validador de proporção de imagem (manter existente)
- [ ] Implementar CRUD completo para ambos componentes
- [ ] Criar endpoints admin e mobile separados
- [ ] Implementar extração e validação de arquivos .zip/.tar.gz
- [ ] Retornar stacks predefinidas por target

### 5.2 Mobile
- [ ] Implementar BannerCarousel com verificação de versão
- [ ] Implementar storage local para banners (AsyncStorage/MMKV)
- [ ] Implementar AdScreen com WebView
- [ ] Implementar storage local para ad_screens (FileSystem)
- [ ] Tratar mensagens do ReactNativeWebView (press, close)
- [ ] Implementar navegação para stacks e links externos

### 5.3 Painel Administrativo
- [ ] Criar página de listagem de banners
- [ ] Criar formulário de banner com upload e preview
- [ ] Criar seletor de ação com stacks filtradas por target
- [ ] Criar página de listagem de ad_screens
- [ ] Criar formulário de ad_screen com upload e preview (iframe)

---

## 6. Exemplo de Uso

### Ad Screen HTML de Exemplo
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Promoção Especial</title>
  <style>
    body { margin:0; padding:0; font-family: system-ui; background:#111; color:#fff; 
           display:flex; justify-content:center; align-items:center; height:100vh; }
    .card { width:min(480px,90vw); padding:24px; border-radius:16px; 
            background:rgba(0,0,0,.6); text-align:center; }
    button { margin-top:18px; padding:12px 18px; border:none; border-radius:12px; 
             background:#0d6efd; color:#fff; font-size:16px; cursor:pointer; }
    .close-btn { background:#6c757d; margin-left:10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Promoção Especial!</h1>
    <p>Confira nossos pacotes de assinatura</p>
    <button onclick="goToSubscriptions()">Ver Assinaturas</button>
    <button class="close-btn" onclick="closeAd()">Fechar</button>
  </div>

  <script>
    function sendMessage(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } else {
        console.log('Mensagem:', msg);
      }
    }

    function goToSubscriptions() {
      sendMessage({
        type: 'press',
        action: { onPress_type: 'stack', onPress_stack: 'Subscriptions' }
      });
    }

    function closeAd() {
      sendMessage({
        type: 'close',
        action: { onClose_stack: 'WelcomeProfessional' }
      });
    }
  </script>
</body>
</html>
```

---

## 7. Observações Importantes

1. **Segurança**: Validar todos os uploads no backend (tipos de arquivo, tamanho máximo)
2. **Performance**: Endpoints de versão devem ser extremamente leves
3. **Cache**: Considerar cache HTTP para endpoints de versão
4. **Logs**: Registrar visualizações e cliques para analytics futuro
5. **Fallback**: Se não houver ads ativos, não exibir carrossel/tela

---

## 8. Implementação Realizada

### 8.1 Backend

#### Arquivos Criados/Modificados:
- [app/core/ads_stacks.py](../backend/app/core/ads_stacks.py) - Configuração de stacks predefinidas por target
- [app/api/endpoints/ads.py](../backend/app/api/endpoints/ads.py) - Endpoints atualizados com:
  - `GET /ads-admin/stacks/{target}` - Listar stacks disponíveis
  - `PUT /ads-admin/banner/{target}/image/{filename}/action` - Editar ação de imagem específica
  - Validação de stacks em uploads de banner e adscreen
- [app/crud/banner_ad.py](../backend/app/crud/banner_ad.py) - Nova função `update_image_action`

#### Stacks Configuradas:

**Cliente:**
- `WelcomeCustomer` - Tela de boas-vindas
- `SearchResults` - Resultados de busca
- `CreateProject` - Criar projeto
- `AllProjects` - Todos os projetos
- `Support` - Suporte

**Profissional:**
- `WelcomeProfessional` - Tela de boas-vindas
- `ProjectsList` - Lista de projetos
- `Credits` - Meus créditos
- `CreditPackages` - Comprar créditos
- `Subscriptions` - Assinaturas
- `Support` - Suporte

### 8.2 Admin Panel

#### Arquivo Modificado:
- [templates/admin/ads.html](../backend/templates/admin/ads.html)

#### Funcionalidades Adicionadas:
- Seletor dinâmico de stacks baseado no target
- Edição individual de ações para cada imagem do banner
- Validação de stacks no frontend
- Toggle automático entre input de URL e seletor de stacks

### 8.3 Mobile

#### Arquivos Criados:
- [src/api/adsService.ts](../mobile/src/api/adsService.ts) - Serviço de ads com:
  - Verificação de versão
  - Cache local de imagens
  - Sync de banners e adscreens
- [src/hooks/useBannerAds.ts](../mobile/src/hooks/useBannerAds.ts) - Hook para banners com:
  - Carregamento otimizado
  - Handling de ações (link externo e navegação interna)
  - Reload manual

### 8.4 Próximos Passos
- [ ] Testar integração completa backend-mobile
- [ ] Implementar extração de ZIP no mobile (requer `react-native-zip-archive`)
- [ ] Adicionar logs de analytics para cliques e impressões
- [ ] Considerar cache HTTP com ETags para endpoints de versão