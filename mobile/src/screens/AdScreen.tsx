import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView, TouchableOpacity, Text, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';
import client from '../api/axiosClient';
import { checkAdScreenVersion } from '../api/adsService';

export default function AdScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Support both legacy 'location' param and new 'target' param
  const params = route.params as {
    location?: 'publi_screen_client' | 'publi_screen_professional';
    target?: 'client' | 'professional';
    role?: 'client' | 'professional';
  };
  const role = params.role;
  // Derive target from 'target' param or from legacy 'location' param
  const target: 'client' | 'professional' = params.target
    ? params.target
    : params.location === 'publi_screen_professional'
    ? 'professional'
    : 'client';

  const [adUri, setAdUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);

  // Navigate based on the user's role (client vs professional)
  const handleContinue = () => {
    // If a role was explicitly passed (ProfileSelection or single-role login), honor it
    if (role) {
      setActiveRole(role);
      if (role === 'client') {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'ProfileSelection' },
              { name: 'WelcomeCustomer' },
            ],
          })
        );
        return;
      }
      if (role === 'professional') {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'ProfileSelection' },
              { name: 'WelcomeProfessional' },
            ],
          })
        );
        return;
      }
    }

    const isClient = user?.roles?.includes('client');
    const isProfessional = user?.roles?.includes('professional');

    if (isClient && isProfessional) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'ProfileSelection' }] }));
      return;
    }

    if (isClient) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'WelcomeCustomer' }] }));
      return;
    }

    if (isProfessional) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'ProfileSelection' }] }));
      return;
    }

    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'WelcomeCustomer' }] }));
  };

  const loadAdScreen = async () => {
    try {
      setLoading(true);
      setHasError(false);

      // Check if AdScreen exists (version > 0 means content is configured)
      const version = await checkAdScreenVersion(target);
      if (version === 0) {
        console.log(`ℹ️ No AdScreen configured for target: ${target}`);
        handleContinue();
        return;
      }

      // Use the public serve endpoint to load the AdScreen HTML in WebView
      const base = client.defaults.baseURL?.replace(/\/$/, '') || '';
      const uri = `${base}/ads-mobile/adscreen/${target}/serve/index.html`;
      console.log(`✅ AdScreen found (v${version}), loading from: ${uri}`);
      setAdUri(uri);
    } catch (error) {
      console.error('�� Error loading AdScreen:', error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdScreen();
  }, [target]);

  const trackClick = async () => {
    try {
      await client.post(`/ads-mobile/click/adscreen_${target}`);
    } catch {
      // Tracking errors are non-critical
    }
  };

  /**
   * Handle messages from the WebView HTML.
   *
   * Supported message formats:
   * - 'Onclose' or 'close': close the AdScreen and navigate to welcome screen
   * - JSON { type: 'internal', action: { onPress_type: 'stack', onPress_stack: 'ScreenName' } }
   * - JSON { type: 'external', link: 'https://...' }
   * - 'click' or 'banner_click': track ad click
   */
  const handleMessage = (event: any) => {
    const raw: string = event.nativeEvent.data;

    // Handle plain string messages first
    if (raw === 'Onclose' || raw === 'close') {
      handleContinue();
      return;
    }

    if (raw === 'click' || raw === 'banner_click') {
      trackClick();
      return;
    }

    // Try to parse as structured JSON message
    try {
      const message = JSON.parse(raw);

      // Handle close messages sent as JSON
      if (message?.type === 'Onclose' || message?.type === 'close') {
        handleContinue();
        return;
      }

      if (message?.type === 'internal' || message?.type === 'press') {
        // Support both legacy action format and the newer "value" shorthand
        const stackName = message?.value || message?.action?.onPress_stack;
        if (stackName) {
          try {
            (navigation as any).navigate(stackName);
          } catch (err) {
            console.error('[AdScreen] Error navigating to stack:', stackName, err);
          }
        }
        return;
      }

      if (message?.type === 'external') {
        const link = message?.link;
        if (link) {
          Linking.openURL(link).catch(err => {
            console.error('[AdScreen] Error opening URL:', link, err);
          });
        }
        return;
      }
    } catch {
      // Not valid JSON — ignore
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Anúncio indisponível</Text>
          <View style={styles.debugActions}>
            <TouchableOpacity style={styles.debugButton} onPress={() => loadAdScreen()}>
              <Text>Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugButton} onPress={handleContinue}>
              <Text>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!adUri) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: adUri }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          )}
          onError={() => {
            console.error('[AdScreen] WebView failed to load:', adUri);
            handleContinue();
          }}
        />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  webviewContainer: {
    flex: 1,
    width: '100%',
  },
  webview: {
    flex: 1,
  },
  debugContainer: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  debugTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  debugActions: { flexDirection: 'row', marginTop: 16 },
  debugButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eee', marginHorizontal: 8 },
});
