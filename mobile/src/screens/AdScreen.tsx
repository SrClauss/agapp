import React from 'react';
import { useRoute } from '@react-navigation/native';
import PubliScreenAd from '../components/PubliScreenAd';

export default function AdScreen() {
  const route = useRoute();
  const { location } = route.params as { location: 'publi_screen_client' | 'publi_screen_professional' };

  // simply delegate to the specialized component
  return <PubliScreenAd adType={location as any} />;
}
