import React from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAd } from '../hooks/useAd';

interface BannerAdProps {
  adType: string;
  height?: number;
  onPress?: () => void;
}

/**
 * Componente que exibe um banner publicitário
 * Usado na tela home dos usuários
 *
 * @example
 * ```tsx
 * // Na tela home
 * <BannerAd adType="banner_client" height={120} />
 * ```
 */
export function BannerAd({ adType, height = 120, onPress }: BannerAdProps) {

  const { adHtml, loading, exists } = useAd(adType);

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;

    // Rastrear cliques
    if (message === 'click') {
      console.log('Usuário clicou no banner');
      onPress?.();
      // Aqui você pode enviar analytics
    }
  };

  // Não mostrar se não existir
  if (!exists) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { height }]}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html: adHtml || '' }}
        style={styles.webview}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
        domStorageEnabled
        // Evitar que o WebView intercepte gestos de scroll da tela
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 8,
    marginVertical: 8,
  },
  loadingContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
