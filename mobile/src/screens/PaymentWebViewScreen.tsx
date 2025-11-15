import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Appbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type PaymentWebViewScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentWebView'
>;
type PaymentWebViewScreenRouteProp = RouteProp<
  RootStackParamList,
  'PaymentWebView'
>;

interface PaymentWebViewScreenProps {
  navigation: PaymentWebViewScreenNavigationProp;
  route: PaymentWebViewScreenRouteProp;
}

export default function PaymentWebViewScreen({
  navigation,
  route,
}: PaymentWebViewScreenProps): React.JSX.Element {
  const { paymentUrl, paymentId, onSuccess } = route.params;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const webViewRef = useRef<WebView>(null);

  const handleNavigationStateChange = (navState: any) => {
    // Detectar conclusão do pagamento baseado na URL
    const url = navState.url.toLowerCase();

    // URLs de sucesso do Asaas
    if (url.includes('success') || url.includes('confirmed') || url.includes('pagamento-confirmado')) {
      Alert.alert(
        'Pagamento Confirmado',
        'Seu pagamento foi processado com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) onSuccess();
              navigation.goBack();
            },
          },
        ]
      );
    }

    // URLs de erro/cancelamento
    if (url.includes('error') || url.includes('cancel') || url.includes('falha')) {
      Alert.alert(
        'Pagamento Cancelado',
        'O pagamento não foi concluído.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Pagamento" />
      </Appbar.Header>

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webView}
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3471b9" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
