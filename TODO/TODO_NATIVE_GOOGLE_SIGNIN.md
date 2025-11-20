# TODO: Implementação Nativa do Google Sign-In

## Contexto

Atualmente o app usa `expo-auth-session` que funciona com Expo Go mas abre navegador/WebView.
Para uma experiência melhor, futuramente migrar para Google Sign-In nativo.

## Implementação Futura (quando criar build nativo)

### 1. Instalar pacote nativo

```bash
npx expo install @react-native-google-signin/google-signin
```

### 2. Configurar app.json

```json
{
  "expo": {
    "plugins": [
      "expo-secure-store",
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

### 3. Atualizar mobile/src/services/googleAuth.ts

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useEffect } from 'react';

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
}

export function useGoogleSignIn() {
  useEffect(() => {
    configureGoogleSignIn();
  }, []);
}

export async function signInWithGoogle(): Promise<string> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();

    if (!tokens.idToken) {
      throw new Error('Não foi possível obter o ID Token do Google');
    }

    return tokens.idToken;
  } catch (error: any) {
    console.error('Erro no Google Sign In:', error);
    throw error;
  }
}

export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Erro ao fazer logout do Google:', error);
  }
}
```

### 4. Atualizar LoginScreen.tsx

```typescript
import { useGoogleSignIn, signInWithGoogle } from '../services/googleAuth';

export default function LoginScreen() {
  // ... outros states ...

  // Inicializar Google Sign In
  useGoogleSignIn();

  const onGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const data = await loginWithGoogle(idToken);
      await setToken(data.token);
      setUser(data.user || (await fetchCurrentUser(data.token)));
    } catch (e: any) {
      if (e.code === '-5') { // Usuário cancelou
        setLoading(false);
        return;
      }
      setError(e.message || 'Erro ao fazer login com Google');
    } finally {
      setLoading(false);
    }
  };

  // ... resto do código ...
}
```

### 5. Criar Development Build

```bash
# Criar build de desenvolvimento
npx expo prebuild

# Android
npx expo run:android

# iOS
npx expo run:ios
```

### 6. Configuração no Google Cloud Console

Para Android, adicionar SHA-1 fingerprint:

```bash
# Debug keystore
keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
# Senha: android

# Production keystore
keytool -keystore /path/to/your/keystore.jks -list -v
```

Adicionar o SHA-1 no Client ID Android no Google Cloud Console.

## Vantagens da Implementação Nativa

1. ✅ Abre bottom sheet nativo (melhor UX)
2. ✅ Não abre navegador externo
3. ✅ Melhor performance
4. ✅ Suporte a biometria (futuro)
5. ✅ Funciona offline para verificar se usuário está logado

## Desvantagens Atuais

1. ❌ Não funciona com Expo Go (precisa de build nativo)
2. ❌ Requer configuração adicional (SHA-1, etc)
3. ❌ Build time maior

## Quando Implementar

- Quando o app estiver pronto para builds nativos (APK/IPA)
- Quando não precisar mais testar com Expo Go
- Antes de enviar para produção (melhor UX)

## Recursos

- [Documentação @react-native-google-signin](https://github.com/react-native-google-signin/google-signin)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Google Sign-In Android Setup](https://developers.google.com/identity/sign-in/android/start-integrating)
- [Google Sign-In iOS Setup](https://developers.google.com/identity/sign-in/ios/start-integrating)
