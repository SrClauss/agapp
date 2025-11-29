import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import useAuthStore from '../stores/authStore';
import client from '../api/axiosClient';

interface AdBannerProps {
  location: 'banner_client_home' | 'banner_professional_home';
}

interface AdContent {
  id: string;
  alias: string;
  type: string;
  html: string;
  css: string;
  js: string;
  images: { [key: string]: string };
}

export default function AdBanner({ location }: AdBannerProps) {
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState(120); // Default height
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    fetchAdContent();
  }, [location]);

  const fetchAdContent = async () => {
    try {
      const { data } = await client.get(`/ads/public/ads/${location}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data) {
        setAdContent(data);
      }
    } catch (error) {
      console.error('Error fetching banner content:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackClick = async () => {
    if (!adContent) return;

    try {
      await client.post(`/ads/public/ads/${adContent.id}/click`, null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;

    // Check if message is height update
    if (message.startsWith('height:')) {
      const newHeight = parseInt(message.replace('height:', ''), 10);
      if (!isNaN(newHeight)) {
        setHeight(newHeight);
      }
    } else if (message === 'click' || message === 'banner_click') {
      trackClick();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
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
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
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

    // Send height to React Native
    function updateHeight() {
      const height = document.body.scrollHeight;
      window.ReactNativeWebView.postMessage('height:' + height);
    }

    window.addEventListener('load', updateHeight);
    window.addEventListener('resize', updateHeight);

    // Initial height
    updateHeight();
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html: fullHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
