import React, { useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, FlatList, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAd } from '../hooks/useAd';

type AdType = 'publi_client' | 'publi_professional' | 'banner_client' | 'banner_professional' | 'banner_cliente_home';

interface BannerAdProps {
  adType: AdType;
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
  const { adHtml, images, loading, exists } = useAd(adType);
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);
  const [index, setIndex] = useState(0);

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
      {images && images.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, idx) => `${item.uri}-${idx}`}
          onMomentumScrollEnd={(ev) => {
            const newIndex = Math.round(ev.nativeEvent.contentOffset.x / width);
            setIndex(newIndex);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (item.link) {
                  Linking.openURL(item.link).catch(() => {});
                }
                onPress?.();
              }}
            >
              <Image
                source={{ uri: item.uri }}
                style={[styles.image, { width, height }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />
      ) : (
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
      )}
      {images && images.length > 1 && (
        <View style={styles.dotsContainer} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>
      )}
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
  image: {
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
});
