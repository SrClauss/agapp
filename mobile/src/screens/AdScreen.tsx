import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';
import client from '../api/axiosClient';
import ImageAdCarousel from '../components/ImageAdCarousel';

interface ImageItem {
  uri: string;
  link?: string | null;
}

interface AdContent {
  id: string;
  alias: string;
  type: 'html' | 'image';
  html?: string;
  uri?: string;
  css?: string;
  js?: string;
  images?: { [key: string]: string };
  imagesList?: ImageItem[];
}

export default function AdScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { location, role } = route.params as { location: 'publi_screen_client' | 'publi_screen_professional'; role?: 'client' | 'professional' };
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [debugPayload, setDebugPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);

  // Navigate based on the user's role (client vs professional)
  const handleContinue = () => {
    // If a role was explicitly passed (ProfileSelection or single-role login), honor it
    if (role) {
      // Persist active role and replace current route with the respective welcome
      setActiveRole(role);
      if (role === 'client') {
        navigation.replace('WelcomeCustomer' as never);
        return;
      }
      if (role === 'professional') {
        navigation.replace('WelcomeProfessional' as never);
        return;
      }
    }

    const isClient = user?.roles?.includes('client');
    const isProfessional = user?.roles?.includes('professional');

    // If user has both roles, replace with ProfileSelection
    if (isClient && isProfessional) {
      navigation.replace('ProfileSelection' as never);
      return;
    }

    if (isClient) {
      navigation.replace('WelcomeCustomer' as never);
      return;
    }

    if (isProfessional) {
      // Professional flows are deprecated for now; replace with ProfileSelection so user can continue
      navigation.replace('ProfileSelection' as never);
      return;
    }

    // Fallback
    navigation.replace('WelcomeCustomer' as never);
  };

  const fetchAdContent = async () => {
    try {
      console.log('🔍 Buscando anúncio para location:', location);

      // Use the static file served by backend (ad HTML + assets)
      const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
      const url = `${base}/ads/${location}/index.html`;
      console.log('🔗 URL do anúncio:', url);

      // Check if the ad exists by fetching the HTML (will 404 if not configured)
      const response = await client.get(url, { responseType: 'text' });

      if (response.status === 200 && response.data) {
        setAdContent({
          id: location,
          alias: location,
          type: 'html',
          uri: url,
        });
        return;
      }

      setDebugPayload({ reason: 'unexpected_response', status: response.status, data: response.data });
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('ℹ️ Nenhum anúncio configurado para esta location (404)');
        setDebugPayload({ reason: 'no_ad_configured', status: 404 });
      } else {
        console.error('🚨 Erro ao buscar anúncio:', error);
        setDebugPayload({ reason: 'fetch_error', error: error?.message || error, status: error.response?.status });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdContent();
  }, [location]);

  const trackClick = async () => {
    if (!location) return;

    try {
      await client.post(`/system-admin/api/public/ads/click/${location}`);
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;
    if (message === 'click' || message === 'banner_click') {
      trackClick();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  if (!adContent) {
    // If we have debug information (no ad / error), show a debug UI so devs can inspect and retry
    if (!loading && debugPayload) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Anúncio indisponível</Text>
            <Text style={styles.debugText}>{JSON.stringify(debugPayload, null, 2)}</Text>
            <View style={styles.debugActions}>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  setDebugPayload(null);
                  setLoading(true);
                  fetchAdContent();
                }}
              >
                <Text>Repetir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  setDebugPayload(null);
                  handleContinue();
                }}
              >
                <Text>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return null;
  }

  const handleClose = () => {
    // Close the ad and continue (respecting a passed role if any)
    handleContinue();
  };

  // Se for anúncio de imagem, usar o componente ImageAdCarousel
  if (adContent.type === 'image' && adContent.imagesList && adContent.imagesList.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ImageAdCarousel images={adContent.imagesList} onClose={handleClose} />
      </SafeAreaView>
    );
  }

  // Se for anúncio HTML, usar WebView carregando a URL do ad
  if (adContent.type === 'html' && adContent.uri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webviewContainer}>
          <WebView
            source={{ uri: adContent.uri }}
            style={styles.webview}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
              </View>
            )}
          />
        </View>

        {/* Overlay close button at the top-right corner (independent of ad template) */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} accessibilityLabel="Fechar anúncio">
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Fallback: se não for nem imagem nem HTML, redirecionar
  handleClose();
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  webviewContainer: {
    flex: 1, // WebView takes full screen height
    width: '100%',
  },
  webview: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 66, // increase top margin to keep inside the container
    right: 22, // increase right margin to keep inside the container
    width: 34,
    height: 34,
    borderRadius: 34 / 2,
    backgroundColor: 'rgba(255,255,255,0.1)', // glass/semi-transparent
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    paddingTop: 1,
    paddingRight: 0,
  },
  closeButtonText: {
    color: '#111', // discreet black 'X'
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  // The bottom button is removed in favor of a top-right overlay close button
  button: {
    width: '100%',
  },
  /* Debug UI styles */
  debugContainer: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  debugTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  debugText: { fontSize: 12, color: '#333', textAlign: 'left' },
  debugActions: { flexDirection: 'row', marginTop: 16 },
  debugButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eee' },
});