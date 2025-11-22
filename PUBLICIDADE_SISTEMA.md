# Sistema de Publicidade - Agiliza Platform

Este documento descreve como usar o sistema de publicidade (PubliScreens e Banners) implementado na plataforma Agiliza.

## Visão Geral

O sistema permite exibir conteúdo HTML/CSS/JS personalizado em dois formatos:

1. **PubliScreens**: Telas inteiras que aparecem após o login, antes da tela principal
2. **Banners**: Banners exibidos no topo das telas principais (Cliente e Profissional)

## Estrutura do Backend

### Modelos de Dados

#### AdContent
Representa um conjunto de arquivos HTML/CSS/JS para publicidade:
- `id`: Identificador único (ULID)
- `alias`: Identificador amigável (ex: "publi_client_welcome")
- `type`: Tipo de anúncio ("publi_screen" ou "banner")
- `target`: Público-alvo ("client", "professional", ou "both")
- `index_html`: Caminho para o arquivo HTML principal
- `css_files`: Lista de arquivos CSS
- `js_files`: Lista de arquivos JavaScript
- `image_files`: Lista de imagens
- `is_active`: Se o anúncio está ativo
- `priority`: Prioridade de exibição
- `start_date/end_date`: Período de exibição (opcional)
- `views/clicks`: Estatísticas de visualização

#### AdAssignment
Mapeia qual conteúdo deve ser exibido em cada localização:
- `location`: Onde exibir ("publi_screen_client", "publi_screen_professional", "banner_client_home", "banner_professional_home")
- `ad_content_id`: ID do AdContent a exibir

### Diretórios

Os arquivos de publicidade são armazenados em:
```
/backend/ads/
├── publi_client_welcome/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── logo.png
├── publi_professional_welcome/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── logo.png
├── banner_client_home/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── banner_professional_home/
    ├── index.html
    ├── style.css
    └── script.js
```

## API Endpoints

### Admin Endpoints (Requer autenticação de admin)

#### Criar Ad Content
```http
POST /ads/ad-contents
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "alias": "publi_client_promo",
  "type": "publi_screen",
  "target": "client",
  "title": "Promoção de Lançamento",
  "description": "Tela de boas-vindas com promoção",
  "priority": 10
}
```

#### Listar Ad Contents
```http
GET /ads/ad-contents?type=publi_screen&is_active=true
Authorization: Bearer <admin_token>
```

#### Upload de Arquivo
```http
POST /ads/ad-contents/{ad_id}/files
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

file: [arquivo]
file_type: "html" | "css" | "js" | "image"
```

Tipos de arquivo suportados:
- **html**: .html, .htm
- **css**: .css
- **js**: .js
- **image**: .png, .jpg, .jpeg, .gif, .svg, .webp

Tamanho máximo: 5MB por arquivo

#### Criar Assignment
```http
POST /ads/ad-assignments
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "location": "publi_screen_client",
  "ad_content_id": "01HQWX2K3M4N5P6Q7R8S9T0V1W"
}
```

#### Deletar Assignment
```http
DELETE /ads/ad-assignments/{location}
Authorization: Bearer <admin_token>
```

### Public Endpoints (Requer autenticação de usuário)

#### Obter Ad para uma Localização
```http
GET /ads/public/ads/{location}
Authorization: Bearer <user_token>
```

Retorna o conteúdo HTML/CSS/JS/imagens pronto para renderização:
```json
{
  "id": "01HQWX2K3M4N5P6Q7R8S9T0V1W",
  "alias": "publi_client_welcome",
  "type": "publi_screen",
  "html": "<html>...</html>",
  "css": "body { ... }",
  "js": "console.log('...');",
  "images": {
    "logo.png": "data:image/png;base64,iVBORw0KG..."
  }
}
```

#### Rastrear Click
```http
POST /ads/public/ads/{ad_id}/click
Authorization: Bearer <user_token>
```

## Fluxo de Uso

### 1. Criar Conteúdo de Publicidade

```bash
# 1. Criar o ad content
curl -X POST http://localhost:8000/ads/ad-contents \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "publi_client_welcome",
    "type": "publi_screen",
    "target": "client",
    "title": "Welcome Screen Cliente",
    "priority": 10
  }'

# Resposta: { "id": "01HQWX...", ... }
```

### 2. Fazer Upload dos Arquivos

```bash
# Upload HTML
curl -X POST http://localhost:8000/ads/ad-contents/01HQWX.../files \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@index.html" \
  -F "file_type=html"

# Upload CSS
curl -X POST http://localhost:8000/ads/ad-contents/01HQWX.../files \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@style.css" \
  -F "file_type=css"

# Upload JS
curl -X POST http://localhost:8000/ads/ad-contents/01HQWX.../files \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@script.js" \
  -F "file_type=js"

# Upload Imagens
curl -X POST http://localhost:8000/ads/ad-contents/01HQWX.../files \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@logo.png" \
  -F "file_type=image"
```

### 3. Atribuir a uma Localização

```bash
curl -X POST http://localhost:8000/ads/ad-assignments \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "publi_screen_client",
    "ad_content_id": "01HQWX..."
  }'
```

## Estrutura dos Arquivos HTML

### PubliScreen

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo!</title>
</head>
<body>
    <div class="fullscreen-ad">
        <h1>Bem-vindo!</h1>
        <p>Conteúdo do anúncio</p>

        <!-- Botão para fechar -->
        <button onclick="window.ReactNativeWebView?.postMessage('close')">
            Fechar
        </button>
    </div>
</body>
</html>
```

### Banner

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Banner</title>
</head>
<body>
    <div class="banner">
        <h3>Título do Banner</h3>
        <p>Descrição</p>

        <!-- Botão para ação -->
        <button onclick="window.ReactNativeWebView?.postMessage('banner_click')">
            Ver Mais
        </button>
    </div>
</body>
</html>
```

## Comunicação com React Native

### Mensagens do WebView para React Native

O HTML pode enviar mensagens para o app React Native:

```javascript
// Fechar PubliScreen
window.ReactNativeWebView?.postMessage('close');

// Registrar click (para analytics)
window.ReactNativeWebView?.postMessage('click');
window.ReactNativeWebView?.postMessage('banner_click');

// Para banners: enviar altura (automático)
window.ReactNativeWebView?.postMessage('height:' + document.body.scrollHeight);
```

### Imagens

As imagens são automaticamente convertidas para base64 data URLs:
```html
<!-- No HTML você referencia assim: -->
<img src="logo.png" alt="Logo" />

<!-- O sistema substitui automaticamente por: -->
<img src="data:image/png;base64,iVBORw0KG..." alt="Logo" />
```

## Localizações Disponíveis

1. **publi_screen_client**: Tela inteira exibida para clientes após login
2. **publi_screen_professional**: Tela inteira exibida para profissionais após login
3. **banner_client_home**: Banner no topo da tela principal do cliente
4. **banner_professional_home**: Banner no topo da tela principal do profissional

## Exemplos Incluídos

O sistema vem com 4 exemplos prontos em `/backend/ads/`:

1. **publi_client_welcome**: PubliScreen de boas-vindas para clientes
2. **publi_professional_welcome**: PubliScreen de boas-vindas para profissionais
3. **banner_client_home**: Banner promocional para clientes
4. **banner_professional_home**: Banner de novos projetos para profissionais

## Analytics

O sistema rastreia automaticamente:
- **Views**: Incrementado quando o ad é carregado
- **Clicks**: Incrementado quando o usuário interage (via postMessage)

Acesse as estatísticas via:
```http
GET /ads/ad-contents/{ad_id}
Authorization: Bearer <admin_token>
```

```json
{
  "id": "...",
  "alias": "publi_client_welcome",
  "views": 1523,
  "clicks": 245,
  ...
}
```

## Melhores Práticas

1. **Responsividade**: Use viewport units (vw, vh) e media queries
2. **Performance**: Otimize imagens antes do upload (< 500KB)
3. **Tamanho**: Mantenha arquivos HTML/CSS/JS pequenos (< 1MB total)
4. **Acessibilidade**: Use alt text em imagens e cores de alto contraste
5. **Teste**: Teste em diferentes tamanhos de tela antes de publicar
6. **Fallback**: Sempre tenha um botão de fechar visível
7. **Datas**: Configure start_date/end_date para campanhas temporárias

## Troubleshooting

### Ad não aparece

1. Verifique se o ad está ativo: `is_active: true`
2. Verifique as datas: `start_date` e `end_date`
3. Verifique se há um assignment para a localização
4. Verifique se todos os arquivos foram upados corretamente

### Imagens não carregam

1. Verifique se o arquivo foi upado como type="image"
2. Verifique o nome do arquivo no HTML (case-sensitive)
3. Formatos suportados: PNG, JPG, JPEG, GIF, SVG, WEBP

### WebView não comunica

1. Use `window.ReactNativeWebView?.postMessage()` com o `?` para segurança
2. Verifique o console do navegador para erros JavaScript
3. Teste o HTML standalone primeiro

## Próximos Passos

Para adicionar ao painel administrativo web:
1. Criar interface de gerenciamento de ads
2. Upload de arquivos via drag-and-drop
3. Preview ao vivo antes de publicar
4. Dashboard de analytics
5. A/B testing de diferentes ads
