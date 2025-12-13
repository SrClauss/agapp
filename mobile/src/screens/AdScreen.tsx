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
  css?: string;
  js?: string;
  images?: { [key: string]: string };
  imagesList?: ImageItem[];
}

export default function AdScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { location } = route.params as { location: 'publi_screen_client' | 'publi_screen_professional' };
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  // Navigate based on the user's role (client vs professional)
  const handleContinue = () => {
    const isClient = user?.roles?.includes('client');
    const isProfessional = user?.roles?.includes('professional');

    // If user has both roles, send them to profile selection
    if (isClient && isProfessional) {
      navigation.navigate('ProfileSelection' as never);
      return;
    }

    if (isClient) {
      navigation.navigate('WelcomeCustomer' as never);
      return;
    }

    if (isProfessional) {
      // Professional flows are deprecated for now; send to profile selection so user can continue
      navigation.navigate('ProfileSelection' as never);
      return;
    }

    // Fallback
    navigation.navigate('WelcomeCustomer' as never);
  };

  const fetchAdContent = async () => {
    try {
      console.log('🔍 Buscando anúncio para location:', location);
      console.log('🔑 Token presente:', !!token);

      // Converter location para adType (formato mobile)
      const adTypeMap: { [key: string]: string } = {
        'publi_screen_client': 'publi_client',
        'publi_screen_professional': 'publi_professional',
        'banner_client_home': 'banner_client',
        'banner_professional_home': 'banner_professional',
      };
      const adType = adTypeMap[location] || location;

      const response = await client.get(`/system-admin/api/public/ads/${adType}`);

      console.log('📡 Status HTTP:', response.status);

      const data = response.data;
      console.log('📦 Dados recebidos:', JSON.stringify(data).substring(0, 200) + '...');

      // Se for tipo imagem, processar imagens
      if (data && data.type === 'image' && data.images && Array.isArray(data.images)) {
        console.log('🖼️ Anúncio do tipo imagem, processando', data.images.length, 'imagens');
        const imagesList: ImageItem[] = data.images.map((img: any) => ({
          uri: img.content || '',
          link: img.link || null,
        })).filter((img: ImageItem) => img.uri); // Filtrar imagens sem URI

        if (imagesList.length === 0) {
          console.log('⚠️ Nenhuma imagem válida encontrada');
          handleContinue();
          return;
        }

        const adaptedAd: AdContent = {
          id: data.ad_type || data.id,
          alias: data.ad_type || data.alias,
          type: 'image',
          imagesList,
        };

        setAdContent(adaptedAd);
      }
      // Se for tipo HTML, processar HTML
      else if (data && data.html) {
        console.log('📄 Anúncio do tipo HTML');
        const adaptedAd: AdContent = {
          id: data.id,
          alias: data.alias,
          type: 'html',
          html: data.html,
          css: data.css || '',
          js: data.js || '',
          images: data.images || {}
        };

        setAdContent(adaptedAd);
      } else {
        console.log('ℹ️ Dados de anúncio inválidos ou vazios');
        handleContinue();
      }
    } catch (error: any) {
      // Status 204 = sem anúncio configurado
      if (error.response?.status === 204) {
        console.log('ℹ️ Nenhum anúncio configurado para esta location');
        handleContinue();
        return;
      }

      console.error('🚨 Erro ao buscar anúncio:', error);
      handleContinue();
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
      await client.post(`/ads/public/ads/${location}/click`);
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
    return null;
  }

  const handleClose = () => {
    // Close the ad and continue
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

  // Se for anúncio HTML, usar WebView
  if (adContent.type === 'html' && adContent.html) {
    // Build complete HTML with injected CSS, JS, and images
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    ${adContent.css || ''}
  </style>
</head>
<body>
  ${adContent.html.replace(/src="([^"]+)"/g, (match, filename) => {
    const imageName = filename.split('/').pop();
    const base64Image = adContent.images?.[imageName];
    return base64Image ? `src="${base64Image}"` : match;
  })}
  <script>
    ${adContent.js || ''}
  </script>
</body>
</html>
    `;

    return (
      <SafeAreaView style={styles.container}>
        {/* WebView occupies full available height */}
        <View style={styles.webviewContainer}>
          <WebView
            source={{ html: fullHTML }}
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
});