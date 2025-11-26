import React, { useState } from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from 'react-native';
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
  const adType = userType === 'client' ? 'publi_client' : 'publi_professional';
  const { adHtml, loading, exists } = useAd(adType);
  const [visible, setVisible] = useState(autoShow);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;

    // O HTML pode enviar mensagem para fechar
    if (message === 'close') {
      handleClose();
    }

    // Rastrear cliques
    if (message === 'click') {
      console.log('Usuário clicou no anúncio PubliScreen');
      // Aqui você pode enviar analytics
    }
  };

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
        <WebView
          source={{ html: adHtml || '' }}
          style={styles.webview}
          onMessage={handleMessage}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          javaScriptEnabled
          domStorageEnabled
        />
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
});
