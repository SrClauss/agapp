import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import useAuthStore from '../stores/authStore';

interface PubliScreenProps {
  location: 'publi_screen_client' | 'publi_screen_professional';
  onClose: () => void;
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

export default function PubliScreen({ location, onClose }: PubliScreenProps) {
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    fetchAdContent();
  }, [location]);

  const fetchAdContent = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/ads/public/ads/${location}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setAdContent(data);
          setVisible(true);
        } else {
          // No ad configured
          onClose();
        }
      } else {
        // Error or no ad
        onClose();
      }
    } catch (error) {
      console.error('Error fetching ad content:', error);
      onClose();
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

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;
    if (message === 'close') {
      handleClose();
    } else if (message === 'click' || message === 'banner_click') {
      trackClick();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!adContent || !visible) {
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={28} color="#333" />
        </TouchableOpacity>

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
    </Modal>
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
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  webview: {
    flex: 1,
  },
});
