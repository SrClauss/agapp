import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useBannerAds } from '../hooks/useBannerAds';
import type { AdTarget } from '../api/adsService';

type AdType = 'publi_client' | 'publi_professional' | 'banner_client' | 'banner_professional' | 'banner_cliente_home';

interface BannerAdProps {
  adType: AdType;
  minHeight?: number;
  maxHeight?: number;
  onPress?: () => void;
}

/** Map legacy adType strings to the new AdTarget ('client' | 'professional') */
function adTypeToTarget(adType: AdType): AdTarget {
  if (adType === 'banner_professional' || adType === 'publi_professional') {
    return 'professional';
  }
  return 'client';
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
  const target = adTypeToTarget(adType);
  const { banners, loading, handleBannerPress } = useBannerAds(target);
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);
  const [bannerHeight, setBannerHeight] = useState<number>(minHeight);
  const [firstImageLoaded, setFirstImageLoaded] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  // Container width: 90% of screen width
  const containerWidth = screenWidth * 0.9;

  // Calculate height based on image dimensions, clamped to min/max
  const calculateHeight = (imgWidth: number, imgHeight: number): number => {
    const ratio = imgHeight / imgWidth;
    const calculatedHeight = containerWidth * ratio;
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  // Skeleton loader
  if (loading) {
    return (
      <View style={[styles.skeletonContainer, { width: containerWidth, height: minHeight }]}>
        <View style={styles.skeletonShimmer} />
      </View>
    );
  }

  // Do not render if no banners
  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: bannerHeight }]}>
      <FlatList
        ref={flatListRef}
        data={banners}
        horizontal
        pagingEnabled
        getItemLayout={(data, idx) => ({
          length: containerWidth,
          offset: containerWidth * idx,
          index: idx
        })}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, idx) => `${item.filename}-${idx}`}
        onMomentumScrollEnd={(ev) => {
          const offsetX = ev.nativeEvent.contentOffset.x;
          const visibleWidth = ev.nativeEvent.layoutMeasurement?.width || containerWidth;
          Math.round(offsetX / visibleWidth);
        }}
        renderItem={({ item, index: itemIndex }) => {
          return (
            <TouchableOpacity
              style={[styles.itemContainer, { width: containerWidth }]}
              activeOpacity={0.8}
              onPress={() => {
                handleBannerPress(item);
                onPress?.();
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
                  // Only the first image sets the banner height and aspect ratio
                  if (itemIndex === 0 && !firstImageLoaded) {
                    const { width: imgW, height: imgH } = e.nativeEvent.source;
                    const aspect = imgW && imgH ? imgW / imgH : null;
                    const newHeight = calculateHeight(imgW, imgH);
                    setBannerHeight(newHeight);
                    if (aspect) setImageAspectRatio(aspect);
                    setFirstImageLoaded(true);
                  }
                }}
                onError={() => {
                  // Image failed to load; swallow silently
                }}
              />
            </TouchableOpacity>
          );
        }}
      />
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
  image: {
    borderRadius: 8,
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
});

