# Integração de Anúncios no Mobile

## 📋 Guia de Integração

Este guia mostra como integrar os anúncios do sistema AgilizaPro no aplicativo mobile React Native.

---

## 🚀 Instalação Rápida

### 1. Instalar Dependências

```bash
npm install react-native-webview @react-native-async-storage/async-storage
# ou
yarn add react-native-webview @react-native-async-storage/async-storage
```

### 2. Arquivos Criados

Os seguintes arquivos já foram criados para você:

```
mobile/src/
├── hooks/
│   └── useAd.ts              # Hook para carregar anúncios
├── components/
│   ├── PubliScreenAd.tsx     # Anúncio em tela cheia
│   └── BannerAd.tsx          # Banner para home
```

---

## 📱 Uso dos Componentes

### PubliScreen (Tela Cheia)

Use após o login do usuário para exibir um anúncio em tela cheia:

```tsx
import { PubliScreenAd } from '../components/PubliScreenAd';

// No seu componente após login
function HomeScreen() {
  const userRole = useAuthStore(state => state.user?.roles[0]);
  const userType = userRole === 'client' ? 'client' : 'professional';

  return (
    <>
      {/* Sua tela normal */}
      <View>
        <Text>Bem-vindo!</Text>
      </View>

      {/* Anúncio PubliScreen */}
      <PubliScreenAd
        userType={userType}
        autoShow={true}
        onClose={() => console.log('Anúncio fechado')}
      />
    </>
  );
}
```

### Banner (Tela Home)

Use na tela home para exibir um banner publicitário:

```tsx
import { BannerAd } from '../components/BannerAd';

function HomeScreen() {
  const userRole = useAuthStore(state => state.user?.roles[0]);
  const userType = userRole === 'client' ? 'client' : 'professional';

  return (
    <ScrollView>
      <Text>Conteúdo da tela</Text>

      {/* Banner publicitário */}
      <BannerAd
        userType={userType}
        height={120}
        onPress={() => console.log('Banner clicado')}
      />

      <Text>Mais conteúdo...</Text>
    </ScrollView>
  );
}
```

---

## 🎯 Tipos de Anúncios

| Tipo | Descrição | Quando usar |
|------|-----------|-------------|
| `publi_client` | PubliScreen para clientes | Após login do cliente |
| `publi_professional` | PubliScreen para profissionais | Após login do profissional |
| `banner_client` | Banner para clientes | Na home do cliente |
| `banner_professional` | Banner para profissionais | Na home do profissional |

---

## 🔧 Uso Avançado

### Hook useAd Diretamente

Se quiser mais controle, use o hook `useAd` diretamente:

```tsx
import { useAd } from '../hooks/useAd';

function CustomAdComponent() {
  const { adHtml, loading, exists, error, reload } = useAd('publi_client');

  if (loading) return <ActivityIndicator />;
  if (!exists) return null;
  if (error) return <Text>Erro ao carregar anúncio</Text>;

  return (
    <WebView
      source={{ html: adHtml }}
      onMessage={(event) => {
        // Processar mensagens do HTML
        console.log(event.nativeEvent.data);
      }}
    />
  );
}
```

### Limpar Cache

Para forçar atualização dos anúncios:

```tsx
import { useClearAdCache } from '../hooks/useAd';

function SettingsScreen() {
  const { clearCache } = useClearAdCache();

  const handleClearCache = async () => {
    // Limpar cache de todos os anúncios
    await clearCache();

    // Ou limpar cache de um anúncio específico
    await clearCache('publi_client');
  };

  return (
    <Button title="Limpar Cache de Anúncios" onPress={handleClearCache} />
  );
}
```

---

## 📡 Endpoints da API

### Buscar Anúncio
```
GET https://agilizapro.net/system-admin/api/public/ads/{ad_type}
```

**Response:**
```json
{
  "ad_type": "publi_client",
  "html": "<!DOCTYPE html>...",
  "assets": {
    "style.css": { "type": "text", "content": "..." },
    "image.png": { "type": "image", "content": "data:image/png;base64,..." }
  }
}
```

### Verificar se Existe
```
GET https://agilizapro.net/system-admin/api/public/ads/{ad_type}/check
```

**Response:**
```json
{
  "ad_type": "publi_client",
  "exists": true,
  "configured": true
}
```

---

## 🎨 Criar Anúncios no Admin

1. Acesse: `https://agilizapro.net/system-admin/ads`
2. Escolha o tipo de anúncio (PubliScreen ou Banner)
3. Faça upload dos arquivos:
   - `index.html` (obrigatório)
   - `style.css` (opcional)
   - `script.js` (opcional)
   - Imagens (opcional)

**Exemplo de HTML básico:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <h1>Meu Anúncio</h1>
    <button onclick="closeAd()">Fechar</button>

    <script>
        function closeAd() {
            window.ReactNativeWebView?.postMessage('close');
        }
    </script>
</body>
</html>
```

---

## 🔌 Comunicação HTML ↔ Mobile

### Do HTML para o Mobile

```javascript
// No HTML
window.ReactNativeWebView?.postMessage('close');  // Fechar anúncio
window.ReactNativeWebView?.postMessage('click');  // Rastrear clique
```

### Do Mobile para o HTML

```tsx
<WebView
  source={{ html: adHtml }}
  onMessage={(event) => {
    const message = event.nativeEvent.data;

    if (message === 'close') {
      // Fechar anúncio
    }
    if (message === 'click') {
      // Rastrear clique
    }
  }}
/>
```

---

## ⚡ Performance

- **Cache:** Os anúncios são salvos localmente por 24h
- **Lazy Loading:** Só carrega quando necessário
- **Check Endpoint:** Verifica existência antes de baixar
- **Base64 Images:** Imagens embutidas no HTML (sem requests extras)

---

## 🐛 Troubleshooting

### Anúncio não aparece

1. Verifique se o anúncio foi configurado no admin
2. Verifique o console para erros de rede
3. Limpe o cache: `clearCache()`
4. Verifique se o `userType` está correto

### Anúncio não fecha

Certifique-se que o HTML está enviando a mensagem:
```javascript
window.ReactNativeWebView?.postMessage('close');
```

### Imagens não aparecem

- Use imagens pequenas (< 200KB)
- O sistema converte automaticamente para base64
- Formatos suportados: PNG, JPG, GIF, SVG, WEBP

---

## 📊 Analytics (Opcional)

Para rastrear visualizações e cliques:

```tsx
import analytics from '@react-native-firebase/analytics';

// No PubliScreenAd
<PubliScreenAd
  userType={userType}
  onClose={() => {
    analytics().logEvent('ad_viewed', {
      ad_type: 'publi_client'
    });
  }}
/>

// No BannerAd
<BannerAd
  userType={userType}
  onPress={() => {
    analytics().logEvent('ad_clicked', {
      ad_type: 'banner_client'
    });
  }}
/>
```

---

## 📝 Exemplo Completo

Ver arquivo: [`examples/ad-example.html`](../../examples/ad-example.html)

Este exemplo inclui:
- ✅ Design responsivo
- ✅ Animações
- ✅ Comunicação com React Native
- ✅ Botão de fechar
- ✅ Rastreamento de cliques
- ✅ Prevenção de zoom no mobile

---

## 🆘 Suporte

Para mais informações, consulte:
- [Documentação da API](../backend/ADS_API_DOCS.md)
- [Exemplo de HTML](../examples/ad-example.html)

---

**Desenvolvido com ❤️ para AgilizaPro**
