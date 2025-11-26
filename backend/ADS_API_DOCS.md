# API de Anúncios - Documentação

## Endpoints Públicos para Mobile/Frontend

### 1. Buscar Anúncio Completo

**Endpoint:** `GET /system-admin/api/public/ads/{ad_type}`

**Descrição:** Retorna o conteúdo completo do anúncio incluindo HTML e todos os assets (CSS, JS, imagens) em base64.

**Tipos de Anúncios disponíveis:**
- `publi_client` - PubliScreen para clientes (tela cheia após login)
- `publi_professional` - PubliScreen para profissionais (tela cheia após login)
- `banner_client` - Banner para tela home dos clientes
- `banner_professional` - Banner para tela home dos profissionais

**Exemplo de Request:**
```bash
GET https://agilizapro.net/system-admin/api/public/ads/publi_client
```

**Exemplo de Response:**
```json
{
  "ad_type": "publi_client",
  "html": "<!DOCTYPE html><html>...</html>",
  "assets": {
    "style.css": {
      "type": "text",
      "content": "body { background: #fff; }"
    },
    "script.js": {
      "type": "text",
      "content": "console.log('Ad loaded');"
    },
    "logo.png": {
      "type": "image",
      "content": "data:image/png;base64,iVBORw0KG..."
    }
  }
}
```

**Status Codes:**
- `200 OK` - Anúncio encontrado
- `404 Not Found` - Anúncio não existe ou não está configurado
- `400 Bad Request` - Tipo de anúncio inválido

---

### 2. Verificar se Anúncio Existe

**Endpoint:** `GET /system-admin/api/public/ads/{ad_type}/check`

**Descrição:** Verifica rapidamente se um anúncio está configurado antes de fazer o download completo.

**Exemplo de Request:**
```bash
GET https://agilizapro.net/system-admin/api/public/ads/banner_client/check
```

**Exemplo de Response:**
```json
{
  "ad_type": "banner_client",
  "exists": true,
  "configured": true
}
```

---

## Implementação no Mobile (React Native)

### Componente PubliScreen

```typescript
import React, { useEffect, useState } from 'react';
import { View, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface AdData {
  ad_type: string;
  html: string;
  assets: {
    [key: string]: {
      type: 'text' | 'image';
      content: string;
    };
  };
}

export const PubliScreenAd = ({ userType }: { userType: 'client' | 'professional' }) => {
  const [adData, setAdData] = useState<AdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    loadAd();
  }, []);

  const loadAd = async () => {
    try {
      const adType = `publi_${userType}`;

      // Primeiro verifica se existe
      const checkResponse = await fetch(
        `https://agilizapro.net/system-admin/api/public/ads/${adType}/check`
      );
      const checkData = await checkResponse.json();

      if (!checkData.exists) {
        setLoading(false);
        return;
      }

      // Se existe, carrega o anúncio completo
      const adResponse = await fetch(
        `https://agilizapro.net/system-admin/api/public/ads/${adType}`
      );
      const data = await adResponse.json();

      setAdData(data);
      setShowAd(true);
    } catch (error) {
      console.error('Erro ao carregar anúncio:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildHtmlWithAssets = () => {
    if (!adData) return '';

    let html = adData.html;

    // Substituir referências a CSS
    Object.keys(adData.assets).forEach(filename => {
      const asset = adData.assets[filename];

      if (asset.type === 'text' && filename.endsWith('.css')) {
        // Injetar CSS inline
        html = html.replace(
          `<link rel="stylesheet" href="${filename}">`,
          `<style>${asset.content}</style>`
        );
        html = html.replace(
          `<link href="${filename}" rel="stylesheet">`,
          `<style>${asset.content}</style>`
        );
      }

      if (asset.type === 'text' && filename.endsWith('.js')) {
        // Injetar JS inline
        html = html.replace(
          `<script src="${filename}"></script>`,
          `<script>${asset.content}</script>`
        );
      }

      if (asset.type === 'image') {
        // Substituir src das imagens por data URL
        html = html.replace(
          new RegExp(`src=["']${filename}["']`, 'g'),
          `src="${asset.content}"`
        );
      }
    });

    return html;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!showAd || !adData) {
    return null;
  }

  return (
    <Modal
      visible={showAd}
      animationType="slide"
      onRequestClose={() => setShowAd(false)}
    >
      <WebView
        source={{ html: buildHtmlWithAssets() }}
        style={{ flex: 1 }}
        onMessage={(event) => {
          // Listener para mensagens do HTML (ex: fechar anúncio)
          if (event.nativeEvent.data === 'close') {
            setShowAd(false);
          }
        }}
      />
    </Modal>
  );
};
```

### Componente Banner

```typescript
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export const BannerAd = ({ userType }: { userType: 'client' | 'professional' }) => {
  const [adHtml, setAdHtml] = useState<string | null>(null);

  useEffect(() => {
    loadBanner();
  }, []);

  const loadBanner = async () => {
    try {
      const adType = `banner_${userType}`;

      const response = await fetch(
        `https://agilizapro.net/system-admin/api/public/ads/${adType}/check`
      );
      const checkData = await response.json();

      if (!checkData.exists) return;

      const adResponse = await fetch(
        `https://agilizapro.net/system-admin/api/public/ads/${adType}`
      );
      const data = await adResponse.json();

      // Processar HTML + assets (mesmo código do PubliScreen)
      let html = data.html;
      // ... processar assets ...

      setAdHtml(html);
    } catch (error) {
      console.error('Erro ao carregar banner:', error);
    }
  };

  if (!adHtml) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: adHtml }}
        style={styles.webview}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 120, // Altura do banner
    width: '100%',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
```

---

## Comunicação HTML → Mobile

Para permitir que o HTML se comunique com o mobile (ex: fechar anúncio, rastrear cliques), adicione no HTML:

```html
<script>
  function closeAd() {
    // Envia mensagem para o React Native
    window.ReactNativeWebView?.postMessage('close');
  }

  function trackClick() {
    window.ReactNativeWebView?.postMessage('click');
    // Aqui você pode adicionar lógica adicional
  }
</script>

<button onclick="closeAd()">Fechar</button>
<a href="#" onclick="trackClick()">Saiba Mais</a>
```

---

## Boas Práticas

1. **Cache Local:** Implemente cache dos anúncios para evitar downloads repetidos
2. **Timeout:** Configure timeout nas requisições (ex: 5 segundos)
3. **Fallback:** Tenha sempre um plano B caso o anúncio não carregue
4. **Analytics:** Rastreie exibições e cliques para métricas
5. **Atualização:** Verifique periodicamente se há novos anúncios (ex: a cada 24h)

---

## Exemplo de Cache

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const AD_CACHE_KEY = 'ad_cache_';
const AD_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

async function getAdWithCache(adType: string) {
  const cacheKey = `${AD_CACHE_KEY}${adType}`;

  try {
    // Tentar ler do cache
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);

      // Verificar se ainda é válido
      if (Date.now() - timestamp < AD_CACHE_DURATION) {
        return data;
      }
    }

    // Buscar do servidor
    const response = await fetch(
      `https://agilizapro.net/system-admin/api/public/ads/${adType}`
    );
    const data = await response.json();

    // Salvar no cache
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );

    return data;
  } catch (error) {
    console.error('Erro ao buscar anúncio:', error);
    return null;
  }
}
```
