import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
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
      console.log('🌐 URL:', `${process.env.EXPO_PUBLIC_API_URL}/ads/public/ads/${location}`);

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/ads/public/ads/${location}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('📡 Status HTTP:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        // Backend retorna { ads: [...] }
        if (data.ads && data.ads.length > 0) {
          const ad = data.ads[0]; // Primeiro anúncio

          const adaptedAd: AdContent = {
            id: ad.id,
            alias: ad.id,
            type: location,
            html: ad.html_content || ad.html || '',
            css: ad.css || '',
            js: ad.js || '',
            images: ad.images || {}
          };

          setAdContent(adaptedAd);
        } else {
          console.log('ℹ️ Nenhum anúncio encontrado');
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
    if (!adContent) return;

    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/ads/public/ads/${adContent.id}/click`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const handleContinue = () => {
    navigation.navigate('Welcome' as never);
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

  return (
    <SafeAreaView style={styles.container}>
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
      <View style={styles.buttonContainer}>
        <Button mode="contained" onPress={handleContinue} style={styles.button}>
          Continuar
        </Button>
      </View>
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
  webview: {
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
  },
});