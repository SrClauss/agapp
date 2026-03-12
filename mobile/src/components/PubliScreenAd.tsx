import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Image,
  FlatList,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { useAd } from '../hooks/useAd';

interface PubliScreenAdProps {
  userType: 'client' | 'professional';
  onClose?: () => void;
  autoShow?: boolean;
}

/**
 * Componente que exibe anúncios em tela cheia (PubliScreen)
 * Aparece após o login do usuário
 *
 * @example
 * ```tsx
 * // No arquivo de navegação após login
 * <PubliScreenAd userType="client" autoShow />
 * ```
 */
export function PubliScreenAd({ userType, onClose, autoShow = true }: PubliScreenAdProps) {
  const navigation = useNavigation();
  const adType = userType === 'client' ? 'publi_client' : 'publi_professional';
  const { adHtml, images, loading, exists } = useAd(adType);
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(autoShow);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const handleMessage = (event: any) => {
    const raw = event.nativeEvent.data;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      msg = { cmd: raw };
    }

    switch (msg.cmd) {
      case 'close':
        handleClose();
        break;
      case 'click':
        console.log('Usuário clicou no anúncio PubliScreen');
        break;
      case 'action1':
      case 'action2':
      case 'action3':
        if (msg.type === 'url' && msg.value) {
          Linking.openURL(msg.value).catch(() => {});
        } else if (msg.type === 'screen' && msg.value) {
          // navegue usando React Navigation
          // caso você use uma ref global, por exemplo NavigationService
          // @ts-ignore
          navigation.navigate(msg.value);
        }
        break;
      default:
        console.log('Mensagem desconhecida do ad:', msg);
    }
  };

  // Cycle behavior when user drags past the first/last items
  // cyclic refs removed

  // Não mostrar se estiver carregando ou não existir
  if (!exists || !visible) {
    return null;
  }

  if (loading) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando anúncio...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Botão de fechar */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* WebView com o anúncio */}
        {images && images.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item.uri}-${idx}`}
            onMomentumScrollEnd={(ev) => {
              const offsetX = ev.nativeEvent.contentOffset.x;
              const visibleWidth = ev.nativeEvent.layoutMeasurement?.width || width;
              const newIndex = Math.round(offsetX / visibleWidth);
              setIndex(newIndex);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.itemContainer, { width, height: '100%' }]} activeOpacity={0.8} onPress={() => item.link && Linking.openURL(item.link).catch(() => {})}>
                <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                <Image source={{ uri: item.uri }} style={[styles.image, { width: width - 16, height: '100%' }]} resizeMode="contain" />
              </TouchableOpacity>
            )}
          />
        ) : (
          <WebView
            source={{ html: adHtml || '' }}
            style={styles.webview}
            onMessage={handleMessage}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </SafeAreaView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 999,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  image: {
    height: '100%'
  }
  ,
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240,240,240,0.6)'
  }
});
