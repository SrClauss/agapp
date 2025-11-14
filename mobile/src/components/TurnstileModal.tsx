import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { API_BASE_URL } from '../config/api.config';

interface TurnstileModalProps {
  visible: boolean;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

const TurnstileModal: React.FC<TurnstileModalProps> = ({
  visible,
  onSuccess,
  onCancel,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      console.log('Mensagem recebida do Turnstile:', data);

      switch (data.type) {
        case 'turnstile_ready':
          setIsLoading(false);
          break;

        case 'turnstile_success':
          console.log('Token Turnstile recebido:', data.token);
          onSuccess(data.token);
          break;

        case 'turnstile_error':
          console.error('Erro no Turnstile:', data.error);
          setError('Erro na verificação. Tente novamente.');
          setIsLoading(false);
          break;
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do WebView:', err);
      setError('Erro ao processar verificação');
    }
  };

  const handleLoadEnd = () => {
    // WebView carregada, mas esperamos o evento 'turnstile_ready'
    console.log('WebView carregada');
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('Erro ao carregar WebView:', nativeEvent);
    setError('Erro ao carregar verificação');
    setIsLoading(false);
  };

  const resetState = () => {
    setIsLoading(true);
    setError(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      onShow={resetState}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Verificação de Segurança</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* WebView Container */}
          <View style={styles.webViewContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Carregando verificação...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  onPress={() => {
                    resetState();
                    webViewRef.current?.reload();
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}

            <WebView
              ref={webViewRef}
              source={{ uri: `${API_BASE_URL}/turnstile` }}
              onMessage={handleMessage}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              style={[styles.webView, isLoading && styles.hidden]}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
              mixedContentMode="always"
              originWhitelist={['*']}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Protegido por Cloudflare Turnstile
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 450,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: height * 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  webViewContainer: {
    height: 400,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default TurnstileModal;
