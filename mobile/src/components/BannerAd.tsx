import React, { useState, useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, FlatList, TouchableOpacity, Linking, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useAd } from '../hooks/useAd';
import { stacksByTarget } from '../constants/bannerStacks';
import client from '../api/axiosClient';

type AdType = 'publi_client' | 'publi_professional' | 'banner_client' | 'banner_professional' | 'banner_cliente_home';

interface BannerAdProps {
  adType: AdType;
  minHeight?: number;
  maxHeight?: number;
  onLongPress?: () => void;
}

// stacks that can be navigated to; must match route names in navigation
export type BannerStack =
  | 'servicosProximos'
  | 'assinatura'
  | 'compraCreditos'
  | 'buyFeaturedProjects'
  | 'assinarPlano'
  | 'meusServicos';

interface BannerContent {
  id: string;
  alias: string;
  type: string;
  html?: string;
  css?: string;
  js?: string;
  images?: { [key: string]: string };
  // new fields
  base64?: string;
  onPress_type?: 'external_link' | 'stack';
  onPress_link?: string;
  onPress_stack?: BannerStack;
}


/**
 * Componente que exibe um banner publicitário
 * Usado na tela home dos usuários
 *
 * @example
 * ```tsx
 * // Na tela home
 * <BannerAd adType="banner_client" minHeight={100} maxHeight={200} onLongPress={() => console.log('long press')} />
 * ```
 */
export function BannerAd({ adType, minHeight = 100, maxHeight = 200, onLongPress }: BannerAdProps) {
  const {
    adHtml,
    images,
    loading,
    exists,
    base64,
    onPress_type,
    onPress_link,
    onPress_stack,
  } = useAd(adType);
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);

  const trackClick = async () => {
    if (!adHtml && !base64) return;
    try {
      await client.post(`/ads/public/ads/${adType}/click`, null);
    } catch (err) {
      console.error('Error tracking banner click', err);
    }
  };
  const [index, setIndex] = useState(0);
  const [bannerHeight, setBannerHeight] = useState<number>(minHeight);
  const [firstImageLoaded, setFirstImageLoaded] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  // Container width: 90% of screen width
  const containerWidth = screenWidth * 0.9;

  const handlePress = () => {
    trackClick();
    if (onPress_type === 'external_link' && onPress_link) {
      Linking.openURL(onPress_link).catch(() => {});
    } else if (onPress_type === 'stack' && onPress_stack) {
      switch (onPress_stack) {
        case 'servicosProximos':
          navigation.navigate('SearchResults' as never, { /* params */ } as never);
          break;
        case 'assinatura':
          navigation.navigate('Subscriptions' as never);
          break;
        case 'compraCreditos':
          navigation.navigate('CreditPackages' as never);
          break;
        case 'buyFeaturedProjects':
          navigation.navigate('ProjectsList' as never, { featuredOnly: true } as never);
          break;
        case 'assinarPlano':
          navigation.navigate('Subscriptions' as never);
          break;
        case 'meusServicos':
          navigation.navigate('AllProjects' as never);
          break;
        default:
          break;
      }
    }
  };

  // Cycle behavior on user swipe: if user tries to swipe past last/first, wrap around.
  // removed cyclic refs (startXRef, prevIndexRef)


  // Calculate height based on image dimensions, clamped to min/max
  const calculateHeight = (imgWidth: number, imgHeight: number): number => {
    const ratio = imgHeight / imgWidth;
    const calculatedHeight = containerWidth * ratio;
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
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
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[styles.container, { width: containerWidth, height: bannerHeight }]}
      >
      {base64 ? (
        <Image
          source={{ uri: base64 }}
          style={[styles.image, { width: containerWidth, height: bannerHeight }]}
          resizeMode="contain"
        />
      ) : images && images.length > 0 ? (
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
                onLongPress={() => {
                  if (item.link) {
                    Linking.openURL(item.link).catch(() => {});
                  }
                  onLongPress?.();
                }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={[
                    styles.image,
                    {
                      height: bannerHeight,
                      width: imageAspectRatio ? Math.min(containerWidth, Math.round(bannerHeight * imageAspectRatio)) : containerWidth,
                      alignSelf: 'center'
                    }
                  ]}
                  resizeMode="contain"
                  onLoad={(e) => {
                    // Apenas a primeira imagem define a altura do banner e a proporção
                    if (itemIndex === 0 && !firstImageLoaded) {
                      const { width: imgW, height: imgH } = e.nativeEvent.source;
                      const aspect = imgW && imgH ? imgW / imgH : null;
                      const newHeight = calculateHeight(imgW, imgH);
                      setBannerHeight(newHeight);
                      if (aspect) setImageAspectRatio(aspect);
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
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled
          domStorageEnabled
          bounces={false}
          overScrollMode="never"
        />
      )}
      {/* Dots/indicators intentionally removed - carousel is autoplaying */}
    </TouchableOpacity>
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
    overflow: 'hidden'
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
