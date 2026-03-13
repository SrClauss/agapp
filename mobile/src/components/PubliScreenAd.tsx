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
import { WebView } from 'react-native-webview';
import { usePubliScreen, PressableAction } from '../hooks/usePubliScreen';

// Support for unzipping in-memory packages
import JSZip from 'jszip';


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
  const adType = userType === 'client' ? 'publi_screen_client' : 'publi_screen_professional';
  const { ad, loading, exists } = usePubliScreen(adType);
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<any> | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(autoShow);

  const handleClose = () => {
    setVisible(false);
    onClose?.();

    // Redirect behavior can be controlled by the ad configuration.
    if (ad?.onClose_redirect) {
      // Prefer external URL, otherwise treat as internal screen name.
      if (ad.onClose_redirect.startsWith('http')) {
        Linking.openURL(ad.onClose_redirect).catch(() => {});
        return;
      }
      navigation.replace(ad.onClose_redirect as never);
      return;
    }

    // Default fallback: Welcome screens
    if (ad?.target === 'client') {
      navigation.replace('WelcomeCustomer' as never);
    } else {
      navigation.replace('WelcomeProfessional' as never);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'press' && ad) {
        const action: PressableAction | undefined = ad.pressables.find(p => p.id === msg.id);
        if (action) {
          if (action.onPress_type === 'external_link' && action.onPress_link) {
            Linking.openURL(action.onPress_link).catch(() => {});
          } else if (action.onPress_type === 'stack' && action.onPress_stack) {
            switch (action.onPress_stack) {
              case 'servicosProximos':
                navigation.navigate('SearchResults' as never);
                break;
              case 'assinatura':
                navigation.navigate('Subscriptions' as never);
                break;
              case 'compraCreditos':
                navigation.navigate('CreditPackages' as never);
                break;
              case 'buyFeaturedProjects':
                navigation.navigate('BuyFeaturedProjects' as never);
                break;
              default:
                break;
            }
          }
        }
      } else if (msg.type === 'close') {
        handleClose();
      }
    } catch (e) {
      console.error('invalid message from publiscreen', e);
    }
  };

  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);

  const unzipToHtml = async (zipB64: string): Promise<string> => {
    try {
      const bytes = atob(zipB64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const zip = await JSZip.loadAsync(arr.buffer);
      // assume entry 'index.html' exists
      const html = await zip.file('index.html')?.async('string');
      if (!html) return '';
      // convert relative refs to data URIs for any files contained
      let result = html;
      await Promise.all(
        Object.keys(zip.files).map(async fname => {
          if (fname === 'index.html') return;
          const file = zip.file(fname);
          if (file) {
            const content = await file.async('base64');
            const mime = fname.endsWith('.css') ? 'text/css' : fname.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
            const dataUrl = `data:${mime};base64,${content}`;
            const regex = new RegExp(fname.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
            result = result.replace(regex, dataUrl);
          }
        })
      );
      return result;
    } catch (e) {
      console.error('failed to unzip package', e);
      return '';
    }
  };

  const buildHtml = () => {
    if (!ad) return generatedHtml || '';

    // Priority: explicit html returned from server
    if (ad.html) return ad.html;

    if (ad.zip_base64) {
      return generatedHtml || '';
    }

    // If we have a base64 image, generate the HTML wrapper with pressables overlay.
    const pressableDivs = (ad.pressables || [])
      .map(p => {
        const left = p.left || 0;
        const top = p.top || 0;
        const width = p.width || 0;
        const height = p.height || 0;
        return `
          <a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'press', id:'${p.id}'})); return false;" 
             style="position:absolute; left:${left}%; top:${top}%; width:${width}%; height:${height}%; display:block;" 
             aria-label="pressable"></a>`;
      })
      .join('');

    const closeButton = `
      <button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'close'}));" 
        style="position:absolute; top:10px; right:10px; width:40px; height:40px; border-radius:20px; border:none; background:rgba(0,0,0,0.5); color:white; font-size:22px;">✕</button>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>html, body { margin:0; padding:0; height:100%; overflow:hidden; }</style>
      </head>
      <body>
        <img src="${ad.base64}" style="width:100%; height:100%; object-fit:cover; display:block;" />
        ${pressableDivs}
        ${closeButton}
      </body>
      </html>
    `;
  };

  // watch for zip_base64 and generate html once
  useEffect(() => {
    if (ad?.zip_base64) {
      unzipToHtml(ad.zip_base64).then(html => setGeneratedHtml(html));
    }
  }, [ad]);

  // Não mostrar se estiver carregando ou anúncio não existir
  if (!exists || !visible || !ad) {
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
          source={{ html: buildHtml() }}
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
