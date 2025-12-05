import React, { useState, useRef, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Linking } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageItem {
  uri: string;
  link?: string | null;
}

interface ImageAdCarouselProps {
  images: ImageItem[];
  onClose: () => void;
}

/**
 * Componente para exibir anúncios de imagem em formato de carrossel
 * Suporta múltiplas imagens com links opcionais
 */
export default function ImageAdCarousel({ images, onClose }: ImageAdCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  // cyclic refs removed

  const handleImagePress = async () => {
    const currentImage = images[currentIndex];
    if (currentImage?.link) {
      try {
        const canOpen = await Linking.canOpenURL(currentImage.link);
        if (canOpen) {
          await Linking.openURL(currentImage.link);
        }
      } catch (error) {
        console.error('Error opening link:', error);
      }
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  // Cycle behavior when user drags past the first/last items

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={(ev) => {
          const offsetX = ev.nativeEvent.contentOffset.x;
          const visibleWidth = ev.nativeEvent.layoutMeasurement?.width || SCREEN_WIDTH;
          const idx = Math.round(offsetX / visibleWidth);
          setCurrentIndex(idx);
        }}
        scrollEventThrottle={16}
        ref={scrollRef}
        style={styles.scrollView}
      >
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={image.link ? 0.8 : 1}
            onPress={handleImagePress}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: image.uri }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination dots removed. Carousel auto-plays every 5 seconds. */}

      {/* Botão de fechar */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        accessibilityLabel="Fechar anúncio"
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 66,
    right: 22,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  closeButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
});
