import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';

interface AdContent {
  id: string;
  alias: string;
  type: string;
  html: string;
  css: string;
  js: string;
  images: { [key: string]: string };
}

export default function AdScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { location } = route.params as { location: 'publi_screen_client' | 'publi_screen_professional' };
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    fetchAdContent();
  }, [location]);

  const fetchAdContent = async () => {
    try {
      console.log('🔍 Buscando anúncio para:', location);
      console.log('🔑 Token presente:', !!token);
      // Use the JSON render endpoint (returns html, css, js, images)
      console.log('🌐 URL:', `${process.env.EXPO_PUBLIC_API_URL}/ads/public/render/${location}`);

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/ads/public/render/${location}`
      );

      console.log('📡 Status HTTP:', response.status);

      // Status 204 = sem anúncio configurado
      if (response.status === 204) {
        console.log('ℹ️ Nenhum anúncio configurado para esta location');
        navigation.navigate('Welcome' as never);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        // Backend returns: { id, alias, type, html, css, js, images }
        if (data && data.html) {
          const adaptedAd: AdContent = {
            id: data.id,
            alias: data.alias,
            type: data.type,
            html: data.html,
            css: data.css || '',
            js: data.js || '',
            images: data.images || {}
          };

          setAdContent(adaptedAd);
        } else {
          console.log('ℹ️ Dados de anúncio inválidos');
          navigation.navigate('Welcome' as never);
        }
      } else {
        console.error('❌ Erro HTTP:', response.status, response.statusText);
        navigation.navigate('Welcome' as never);
      }
    } catch (error) {
      console.error('🚨 Erro de rede:', error);
      navigation.navigate('Welcome' as never);
    } finally {
      setLoading(false);
    }
  };

  const trackClick = async () => {
    if (!location) return;

    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/ads/public/ads/${location}/click`,
        {
          method: 'POST',
        }
      );
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  // Navigate based on the user's role (client vs professional)
  const user = useAuthStore((state) => state.user);
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
      navigation.navigate('ProfessionalHome' as never);
      return;
    }

    // Fallback
    navigation.navigate('WelcomeCustomer' as never);
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

  // Build complete HTML with injected CSS, JS, and images
  const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    ${adContent.css}
  </style>
</head>
<body>
  ${adContent.html.replace(/src="([^"]+)"/g, (match, filename) => {
    const imageName = filename.split('/').pop();
    const base64Image = adContent.images[imageName];
    return base64Image ? `src="${base64Image}"` : match;
  })}
  <script>
    ${adContent.js}
  </script>
</body>
</html>
  `;

  const handleClose = () => {
    // Close the ad and continue
    handleContinue();
  };

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