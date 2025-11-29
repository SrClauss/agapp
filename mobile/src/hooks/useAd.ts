import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/axiosClient';
import { AxiosError } from 'axios';

const AD_CACHE_KEY = 'ad_cache_';
const AD_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

interface AdAsset {
  type: 'text' | 'image';
  content: string;
}

interface AdData {
  ad_type: string;
  html: string;
  assets: {
    [key: string]: AdAsset;
  };
}

interface UseAdReturn {
  adHtml: string | null;
  loading: boolean;
  error: Error | null;
  exists: boolean;
  reload: () => Promise<void>;
}

/**
 * Hook para carregar e processar anúncios do servidor
 *
 * @param adType - Tipo do anúncio: 'publi_client', 'publi_professional', 'banner_client', 'banner_professional'
 * @param enabled - Se false, não carrega o anúncio
 * @param useCache - Se true, usa cache local (padrão: true)
 *
 * @example
 * ```tsx
 * const { adHtml, loading, exists } = useAd('publi_client');
 *
 * if (loading) return <ActivityIndicator />;
 * if (!exists) return null;
 *
 * return <WebView source={{ html: adHtml }} />;
 * ```
 */
export function useAd(
  adType: 'publi_client' | 'publi_professional' | 'banner_client' | 'banner_professional' | 'banner_cliente_home',
  enabled: boolean = true,
  useCache: boolean = true
): UseAdReturn {
  const [adHtml, setAdHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [exists, setExists] = useState(false);

  const buildHtmlWithAssets = (data: AdData): string => {
    let html = data.html;

    // Processar assets
    Object.keys(data.assets).forEach(filename => {
      const asset = data.assets[filename];

      if (asset.type === 'text' && filename.endsWith('.css')) {
        // Injetar CSS inline
        html = html.replace(
          new RegExp(`<link[^>]*href=["']${filename}["'][^>]*>`, 'g'),
          `<style>${asset.content}</style>`
        );
      }

      if (asset.type === 'text' && filename.endsWith('.js')) {
        // Injetar JS inline
        html = html.replace(
          new RegExp(`<script[^>]*src=["']${filename}["'][^>]*></script>`, 'g'),
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

  const loadAdFromCache = async (): Promise<AdData | null> => {
    if (!useCache) return null;

    try {
      const cacheKey = `${AD_CACHE_KEY}${adType}`;
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);

      // Verificar se ainda é válido
      if (Date.now() - timestamp < AD_CACHE_DURATION) {
        return data;
      }

      // Cache expirado, remover
      await AsyncStorage.removeItem(cacheKey);
      return null;
    } catch (err) {
      console.error('Erro ao ler cache do anúncio:', err);
      return null;
    }
  };

  const saveAdToCache = async (data: AdData): Promise<void> => {
    if (!useCache) return;

    try {
      const cacheKey = `${AD_CACHE_KEY}${adType}`;
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (err) {
      console.error('Erro ao salvar cache do anúncio:', err);
    }
  };

  const loadAd = async (): Promise<void> => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Tentar carregar do cache primeiro
      const cachedAd = await loadAdFromCache();
      if (cachedAd) {
        const html = buildHtmlWithAssets(cachedAd);
        setAdHtml(html);
        setExists(true);
        setLoading(false);
        return;
      }

      // Verificar se o anúncio existe
      const checkResponse = await client.get(`/system-admin/api/public/ads/${adType}/check`, {
        timeout: 5000,
      });

      const checkData = checkResponse.data;

      if (!checkData.exists) {
        setExists(false);
        setLoading(false);
        return;
      }

      // Carregar anúncio completo
      const adResponse = await client.get(`/system-admin/api/public/ads/${adType}`, {
        timeout: 10000,
      });

      const adData: AdData = adResponse.data;

      // Processar HTML com assets
      const html = buildHtmlWithAssets(adData);

      // Salvar no cache
      await saveAdToCache(adData);

      setAdHtml(html);
      setExists(true);
    } catch (err) {
      console.error('Erro ao carregar anúncio:', err);
      setError(err as Error);
      setExists(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAd();
  }, [adType, enabled]);

  return {
    adHtml,
    loading,
    error,
    exists,
    reload: loadAd,
  };
}

/**
 * Hook para limpar o cache de anúncios
 */
export function useClearAdCache() {
  const clearCache = async (adType?: string) => {
    try {
      if (adType) {
        // Limpar cache de um anúncio específico
        const cacheKey = `${AD_CACHE_KEY}${adType}`;
        await AsyncStorage.removeItem(cacheKey);
      } else {
        // Limpar cache de todos os anúncios
        const keys = await AsyncStorage.getAllKeys();
        const adKeys = keys.filter((key: string) => key.startsWith(AD_CACHE_KEY));
        await AsyncStorage.multiRemove(adKeys);
      }
    } catch (err) {
      console.error('Erro ao limpar cache de anúncios:', err);
    }
  };

  return { clearCache };
}
