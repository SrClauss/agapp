import { useState, useEffect } from 'react';
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
  // Can be either raw HTML (legacy) or a base64 image with pressables.
  html?: string;
  base64?: string;
  onClose_redirect?: string;
  pressables: PressableAction[];
  is_active: boolean;
  priority: number;
};

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
      const response = await client.get(`/system-admin/api/public/ads/${adType}`);
      if (response.status === 204) {
        setExists(false);
        setLoading(false);
        return;
      }
      const data = response.data as PubliScreenAd;
      setAd(data);
      setExists(true);
    } catch (err) {
      console.error('usePubliScreen error', err);
      setError(err as Error);
      setExists(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [adType, enabled]);

  return { ad, loading, exists, error, reload: load };
}
