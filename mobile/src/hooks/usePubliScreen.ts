import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/axiosClient';

export type PressableAction = {
  id: string;
  onPress_type: 'external_link' | 'stack';
  onPress_link?: string;
  onPress_stack?: string;
};

export type PubliScreenAd = {
  alias: string;
  target: 'client' | 'professional';
  // Pode ser HTML estático (legado), ou ZIP com index.html + assets.
  html?: string;
  zip_base64?: string; // ZIP em base64 para transporte JSON
  etag?: string;       // hash do updated_at — controle de versão
  onClose_redirect?: string;
  pressables: PressableAction[];
  is_active: boolean;
  priority: number;
};

// Chaves de cache no AsyncStorage
const cacheKey = (adType: string) => `publiscreen_cache_${adType}`;
const etagKey  = (adType: string) => `publiscreen_etag_${adType}`;

export function usePubliScreen(
  adType: 'publi_screen_client' | 'publi_screen_professional',
  enabled: boolean = true
) {
  const [ad, setAd] = useState<PubliScreenAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      // 1. Verifica etag atual no servidor (rota leve — sem blob)
      const checkResp = await client.get(`/system-admin/api/public/ads/${adType}/check`);
      const serverEtag: string | null = checkResp.data?.etag ?? null;
      const serverExists: boolean = checkResp.data?.exists ?? false;

      if (!serverExists) {
        setExists(false);
        setLoading(false);
        return;
      }

      // 2. Compara com etag em cache
      const cachedEtag = await AsyncStorage.getItem(etagKey(adType));

      if (serverEtag && cachedEtag === serverEtag) {
        // Versão idêntica — carrega do cache local sem fazer download do blob
        const cached = await AsyncStorage.getItem(cacheKey(adType));
        if (cached) {
          setAd(JSON.parse(cached) as PubliScreenAd);
          setExists(true);
          setLoading(false);
          return;
        }
      }

      // 3. Etag mudou (ou não há cache) — faz download completo
      const headers: Record<string, string> = {};
      if (cachedEtag) headers['If-None-Match'] = `"${cachedEtag}"`;

      const response = await client.get(`/system-admin/api/public/ads/${adType}`, {
        headers,
        // Permite 304 sem lançar exceção
        validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
      });

      if (response.status === 304) {
        // Servidor confirmou que não mudou — usa cache
        const cached = await AsyncStorage.getItem(cacheKey(adType));
        if (cached) {
          setAd(JSON.parse(cached) as PubliScreenAd);
          setExists(true);
        } else {
          setExists(false);
        }
        return;
      }

      if (response.status === 204) {
        setExists(false);
        return;
      }

      // 4. Resposta nova — persiste no AsyncStorage e usa
      const data = response.data as PubliScreenAd;
      const newEtag = serverEtag ?? data.etag ?? null;
      await AsyncStorage.setItem(cacheKey(adType), JSON.stringify(data));
      if (newEtag) await AsyncStorage.setItem(etagKey(adType), newEtag);

      setAd(data);
      setExists(true);
    } catch (err) {
      console.error('usePubliScreen error', err);
      setError(err as Error);
      // Fallback: tenta servir do cache mesmo em caso de erro de rede
      try {
        const cached = await AsyncStorage.getItem(cacheKey(adType));
        if (cached) {
          setAd(JSON.parse(cached) as PubliScreenAd);
          setExists(true);
        } else {
          setExists(false);
        }
      } catch {
        setExists(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [adType, enabled]);

  return { ad, loading, exists, error, reload: load };
}
