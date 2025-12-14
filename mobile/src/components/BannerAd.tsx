import React, { useState, useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, FlatList, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAd } from '../hooks/useAd';

type AdType = 'publi_client' | 'publi_professional' | 'banner_client' | 'banner_professional' | 'banner_cliente_home';

interface BannerAdProps {
  adType: AdType;
  minHeight?: number;
  maxHeight?: number;
  onPress?: () => void;
}

/**
 * Componente que exibe um banner publicitário
 * Usado na tela home dos usuários
 *
 * @example
 * ```tsx
 * // Na tela home
 * <BannerAd adType="banner_client" minHeight={100} maxHeight={200} />
 * ```
 */
export function BannerAd({ adType, minHeight = 100, maxHeight = 200, onPress }: BannerAdProps) {
  const { adHtml, images, loading, exists } = useAd(adType);
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);
  const [index, setIndex] = useState(0);
  const [bannerHeight, setBannerHeight] = useState<number>(minHeight);
  const [firstImageLoaded, setFirstImageLoaded] = useState(false);

  // Container width: 90% of screen width
  const containerWidth = screenWidth * 0.9;

  // Cycle behavior on user swipe: if user tries to swipe past last/first, wrap around.
  // removed cyclic refs (startXRef, prevIndexRef)


  // Calculate height based on image dimensions, clamped to min/max
  const calculateHeight = (imgWidth: number, imgHeight: number): number => {
    const ratio = imgHeight / imgWidth;
    const calculatedHeight = containerWidth * ratio;
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;

    // Rastrear cliques
    if (message === 'click') {
      onPress?.();
      // Aqui você pode enviar analytics
    }
  };

  // Não mostrar se não existir
  if (!exists) {
    return null;
  }

  // Skeleton loader
  if (loading) {
    return (
      <View style={[styles.skeletonContainer, { width: containerWidth, height: minHeight }]}>
        <View style={styles.skeletonShimmer} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: bannerHeight }]}>
      {images && images.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          getItemLayout={(data, idx) => ({
            length: containerWidth,
            offset: containerWidth * idx,
            index: idx
          })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, idx) => `${item.uri}-${idx}`}
          onMomentumScrollEnd={(ev) => {
            const offsetX = ev.nativeEvent.contentOffset.x;
            const visibleWidth = ev.nativeEvent.layoutMeasurement?.width || containerWidth;
            const newIndex = Math.round(offsetX / visibleWidth);
            setIndex(newIndex);
          }}
          renderItem={({ item, index: itemIndex }) => {
            return (
              <TouchableOpacity
                style={[styles.itemContainer, { width: containerWidth }]}
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
                  style={[
                    styles.image,
                    {
                      width: containerWidth,
                      height: bannerHeight
                    }
                  ]}
                  resizeMode="cover"
                  onLoad={(e) => {
                    // Apenas a primeira imagem define a altura do banner
                    if (itemIndex === 0 && !firstImageLoaded) {
                      const { width: imgW, height: imgH } = e.nativeEvent.source;
                      const newHeight = calculateHeight(imgW, imgH);
                      setBannerHeight(newHeight);
                      setFirstImageLoaded(true);
                    }
                  }}
                  onError={(e) => {
                    // Image failed to load; swallow silently or track via analytics if needed
                  }}
                />
              </TouchableOpacity>
            );
          }}
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
      {/* Dots/indicators intentionally removed - carousel is autoplaying */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
    marginVertical: 8,
    alignSelf: 'center',
  },
  skeletonContainer: {
    alignSelf: 'center',
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  skeletonShimmer: {
    flex: 1,
    backgroundColor: '#F2F8FC',
    opacity: 0.5,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  image: {
    borderRadius: 8,
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
