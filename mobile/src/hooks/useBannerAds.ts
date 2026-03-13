/**
 * Hook para carregar banners usando o novo sistema de ads
 * com verificação de versão e cache local
 */
import { useState, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { syncBanners, LocalBannerData, AdTarget, clearBannerCache } from '../api/adsService';

export interface BannerItem {
  uri: string;
  filename: string;
  actionType: 'none' | 'external' | 'internal';
  actionValue: string | null;
}

export interface UseBannerAdsReturn {
  banners: BannerItem[];
  loading: boolean;
  error: Error | null;
  version: number;
  reload: () => Promise<void>;
  handleBannerPress: (banner: BannerItem) => void;
}

/**
 * Hook para carregar e gerenciar banners
 * 
 * @param target - 'client' ou 'professional'
 * @param enabled - Se false, não carrega os banners
 * 
 * @example
 * ```tsx
 * const { banners, loading, handleBannerPress } = useBannerAds('client');
 * 
 * if (loading) return <ActivityIndicator />;
 * if (banners.length === 0) return null;
 * 
 * return (
 *   <FlatList
 *     data={banners}
 *     renderItem={({ item }) => (
 *       <TouchableOpacity onPress={() => handleBannerPress(item)}>
 *         <Image source={{ uri: item.uri }} />
 *       </TouchableOpacity>
 *     )}
 *   />
 * );
 * ```
 */
export function useBannerAds(
  target: AdTarget,
  enabled: boolean = true
): UseBannerAdsReturn {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const navigation = useNavigation();

  const loadBanners = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await syncBanners(target);

      if (!data || data.images.length === 0) {
        setBanners([]);
        setVersion(0);
        return;
      }

      const items: BannerItem[] = data.images.map(img => ({
        uri: img.localUri,
        filename: img.filename,
        actionType: img.action_type as 'none' | 'external' | 'internal',
        actionValue: img.action_value,
      }));

      setBanners(items);
      setVersion(data.version);
    } catch (err) {
      console.error('[useBannerAds] Error loading banners:', err);
      setError(err as Error);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [target, enabled]);

  const handleBannerPress = useCallback((banner: BannerItem) => {
    if (banner.actionType === 'none' || !banner.actionValue) {
      return;
    }

    if (banner.actionType === 'external') {
      // Abrir link externo
      Linking.openURL(banner.actionValue).catch(err => {
        console.error('[useBannerAds] Error opening URL:', err);
      });
      return;
    }

    if (banner.actionType === 'internal') {
      // Navegar para stack interna
      try {
        // @ts-ignore - navegação dinâmica
        navigation.navigate(banner.actionValue);
      } catch (err) {
        console.error('[useBannerAds] Error navigating:', err);
      }
    }
  }, [navigation]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  return {
    banners,
    loading,
    error,
    version,
    reload: loadBanners,
    handleBannerPress,
  };
}

/**
 * Hook para limpar cache de banners
 */
export function useClearBannerCache() {
  const clear = useCallback(async (target?: AdTarget) => {
    await clearBannerCache(target);
  }, []);

  return { clearCache: clear };
}
