import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/axiosClient';
import { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';

const AD_CACHE_KEY = 'ad_cache_';
const AD_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

interface AdAsset {
  type: 'text' | 'image';
  content: string;
}

interface ImageItem {
  filename: string;
  content: string; // data URI or URL
  link?: string; // optional click-through link
}

interface AdData {
  ad_type: string;
  html?: string | null;
  assets?: {
    [key: string]: AdAsset;
  };
  images?: ImageItem[];
}

// Helper: map adType to location used in backend URLs
const adTypeToLocation = (adTypeParam: string): string | null => {
  const map: { [k: string]: string } = {
    publi_client: 'publi_screen_client',
    publi_professional: 'publi_screen_professional',
    banner_client: 'banner_client_home',
    banner_professional: 'banner_professional_home',
    banner_cliente_home: 'banner_client_home',
  };
  return map[adTypeParam] || null;
};

// Ensure image is saved locally; returns local URI (file://) or an empty string
const ensureImageLocal = async (img: ImageItem, adTypeParam: string): Promise<string> => {
  if (!img) {
    return '';
  }

  const folder = `${FileSystem.cacheDirectory}ads/${adTypeParam}/`;
  

  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  } catch (e) {
    // ignore
  }

  const filename = img.filename || `${Date.now()}.png`;
  const localPath = `${folder}${filename}`;

  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    return localPath;
  }

  if (img.content && img.content.startsWith('data:image')) {
    try {
      const base64 = img.content.split(',')[1];
      await FileSystem.writeAsStringAsync(localPath, base64, { encoding: FileSystem.EncodingType.Base64 });
      return localPath;
    } catch (error) {
      console.error('[ensureImageLocal] Error saving base64 image:', error);
      // Fallback to returning the base64 data URI
      return img.content;
    }
  }

  // If URL or relative path, download
  if (img.content && (img.content.startsWith('http://') || img.content.startsWith('https://'))) {
    const result = await FileSystem.downloadAsync(img.content, localPath);
    if (result.status === 200) return result.uri;
    throw new Error('Download failed');
  }

  // If null or a relative filename, derive from backend path
  const location = adTypeToLocation(adTypeParam);
  if (location && img.filename) {
    const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
    const url = `${base}/ads/${location}/${encodeURIComponent(img.filename)}`;
    const result = await FileSystem.downloadAsync(url, localPath);
    if (result.status === 200) return result.uri;
  }

  return img.content || '';
};

interface UseAdReturn {
  adHtml: string | null;
  images: Array<{ uri: string; link?: string }> | null;
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
  const [images, setImages] = useState<Array<{ uri: string; link?: string }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [exists, setExists] = useState(false);

  const buildHtmlWithAssets = (data: AdData): string => {
    let html = data.html || '';

    // Processar assets
    const assetKeys = data.assets ? Object.keys(data.assets) : [];
    assetKeys.forEach(filename => {
      const asset = data.assets?.[filename];
      if (!asset) return;

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
      // Avoid storing large image contents in AsyncStorage (can crash on Android / SQLite CursorWindow)
      const safeData: any = { ...data };
      if (safeData.assets) {
        // Remove asset image contents (images may be large base64 strings)
        Object.keys(safeData.assets).forEach((k) => {
          if (safeData.assets[k]?.type === 'image') {
            // Keep filename but drop content
            safeData.assets[k] = { type: 'image', content: null };
          }
        });
      }
      if (safeData.images) {
        // Keep only metadata for images (filename, link), drop base64 content
        safeData.images = safeData.images.map((img: any) => ({ filename: img.filename, content: null, link: img.link }));
      }

      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: safeData,
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
        // If cached includes images metadata, we might not have image content cached (we dropped it)
        if (cachedAd.images && cachedAd.images.length > 0) {
          const imgs = cachedAd.images.map(i => ({ uri: i.content, link: i.link }));
          // Note: cached image content may be null (we don't persist base64). UI should try to render only if uri is set.
          const availableImgs = imgs.filter(i => i.uri);
          if (availableImgs.length > 0) {
            setImages(availableImgs);
            setExists(true);
            setLoading(false);
            return;
          }
        } else if (cachedAd.html) {
          // Only use cached HTML if it exists
          const html = buildHtmlWithAssets(cachedAd);
          setAdHtml(html);
          setExists(true);
          setLoading(false);
          return;
        }
        // If no valid cached content, fallthrough to load from server
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
      

      // If the payload includes images, set them and skip building HTML
      if (adData.images && adData.images.length > 0) {
        
        const imgs: Array<{ uri: string; link?: string }> = [];
        for (const i of adData.images) {
          try {
            const local = await ensureImageLocal(i, adType);
            imgs.push({ uri: local || i.content, link: i.link });
          } catch (err) {
            console.error('[useAd] Error ensuring image local:', err);
            imgs.push({ uri: i.content, link: i.link });
          }
        }
        

        // Salvar no cache com o mesmo formato que o objeto completo (but not base64 content)
        await saveAdToCache(adData as AdData);

        setImages(imgs);
        setExists(true);
        setLoading(false);
        return;
      }

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
    images,
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
        // Remove local cached images for this adType
        try {
          const folder = `${FileSystem.cacheDirectory}ads/${adType}`;
          const info = await FileSystem.getInfoAsync(folder);
          if (info.exists) {
            await FileSystem.deleteAsync(folder, { idempotent: true });
          }
        } catch (e) {
          // ignore errors
        }
      } else {
        // Limpar cache de todos os anúncios
        const keys = await AsyncStorage.getAllKeys();
        const adKeys = keys.filter((key: string) => key.startsWith(AD_CACHE_KEY));
        await AsyncStorage.multiRemove(adKeys);
        // Delete all ad images in local cache
        try {
          const root = `${FileSystem.cacheDirectory}ads`;
          const info = await FileSystem.getInfoAsync(root);
          if (info.exists) {
            await FileSystem.deleteAsync(root, { idempotent: true });
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error('Erro ao limpar cache de anúncios:', err);
    }
  };

  return { clearCache };
}
