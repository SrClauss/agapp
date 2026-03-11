# Plano de Implementação Expo Go

> **Objetivo:** tornar o aplicativo mobile executável no Expo Go, substituindo módulos nativos incompatíveis por alternativas suportadas pelo SDK Expo.

---

## Contexto

O app mobile usava `@react-native-google-signin/google-signin`, um módulo nativo que **não é compatível com o Expo Go**. Para rodar o app sem compilação nativa (via `expo start --go`), é necessário substituir esse módulo por `expo-auth-session/providers/google`, que já faz parte do SDK do Expo Go.

Módulos que **continuam funcionando** no Expo Go:
- `react-native-maps` ✅
- `react-native-webview` ✅
- `expo-secure-store` ✅
- `expo-notifications` ✅
- `expo-location` ✅
- `expo-auth-session` ✅
- `expo-web-browser` ✅

---

## Mudanças Implementadas

### 1. Substituição do Google Sign-In

**Arquivo:** `mobile/src/services/googleAuth.ts`

| Antes | Depois |
|-------|--------|
| `@react-native-google-signin/google-signin` | `expo-auth-session/providers/google` |
| Flow imperativo (async/await) | Flow reativo (hook + `useEffect`) |
| Plugin nativo obrigatório | Funciona em Expo Go sem build nativo |

O hook `useGoogleAuth()` agora expõe:
- `request` — objeto de requisição OAuth (para checar se está pronto)
- `response` — resposta OAuth (monitorar via `useEffect`)
- `signIn()` — abre o fluxo de autenticação web

### 2. Adaptação do `LoginScreen`

**Arquivo:** `mobile/src/screens/LoginScreen.tsx`

A função `onGoogleLogin` foi simplificada para apenas disparar `signIn()`. Um `useEffect` monitora `response` e chama `handleGoogleAuthSuccess` quando a autenticação é concluída com sucesso.

### 3. Remoção do Plugin Nativo

**Arquivo:** `mobile/app.json`

Removido `"@react-native-google-signin/google-signin"` da lista de `plugins`. Isso permite que o app seja executado no Expo Go sem erros de módulo nativo.

### 4. Atualização de Dependências

**Arquivo:** `mobile/package.json`

- Removida dependência: `@react-native-google-signin/google-signin`
- Adicionado script: `"start:go": "expo start"` (alternativa explícita para Expo Go)

---

## Variáveis de Ambiente Necessárias

```env
# Google OAuth Client IDs (Google Cloud Console)
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=xxx.apps.googleusercontent.com
```

> Ver `.env.example` para valores de exemplo.

---

## Como Rodar com Expo Go

```bash
cd mobile
cp .env.example .env  # configurar variáveis de ambiente
npm install
npm run start:go      # abre o tunnel para Expo Go (usa expo start --go)
```

Escaneie o QR code com o app **Expo Go** no Android ou iOS.

---

## Limitações

- O fluxo de login com Google abrirá um **navegador web** em vez do seletor nativo de conta. A experiência é ligeiramente diferente mas funcional.
- Em builds de produção (EAS Build), o comportamento é idêntico ao fluxo web.

---

## Para Builds de Produção (EAS)

Para gerar builds nativas de produção, continue usando o EAS Build conforme configurado em `eas.json`. Não é necessário reinstalar `@react-native-google-signin/google-signin`, pois `expo-auth-session` funciona tanto em Expo Go quanto em builds nativas.

```bash
eas build --platform android
eas build --platform ios
```
