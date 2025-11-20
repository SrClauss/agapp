# Configuração do Google OAuth

Este guia explica como configurar a autenticação com Google no aplicativo mobile.

**IMPORTANTE**: O app usa `expo-auth-session` com `useProxy: true` para abrir o login do Google em uma WebView dentro do app (não abre navegador externo).

## Pré-requisitos

1. Conta do Google Cloud Platform
2. Projeto criado no Google Cloud Console

## Passo a Passo

### 1. Configurar OAuth Consent Screen (PRIMEIRO PASSO - OBRIGATÓRIO)

1. Acesse [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent?project=agilizzapp-206f1)
2. Escolha **External** se for para uso público
3. Preencha as informações obrigatórias:
   - **App name**: AgilizaPro
   - **User support email**: seu-email@gmail.com
   - **Developer contact information**: seu-email@gmail.com
   - **App logo** (opcional)
   - **Application home page** (opcional): https://agilizapro.cloud
   - **Application privacy policy link** (opcional): https://agilizapro.cloud/privacy
   - **Application terms of service link** (opcional): https://agilizapro.cloud/terms
4. Clique em **SAVE AND CONTINUE**
5. Em **Scopes**, adicione os scopes necessários:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Clique em **SAVE AND CONTINUE**
7. Em **Test users**, adicione os emails que você vai usar para testar:
   - Clique em **+ ADD USERS**
   - Digite seu email de teste (ex: seu-email@gmail.com)
   - Clique em **SAVE AND CONTINUE**
8. Revise e clique em **BACK TO DASHBOARD**

**IMPORTANTE**: Enquanto o app estiver em modo "Testing", apenas os emails adicionados em "Test users" conseguirão fazer login!

### 2. Criar Credenciais OAuth no Google Cloud Console

1. Acesse [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials?project=agilizzapp-206f1)
2. Clique em **+ CREATE CREDENTIALS** > **OAuth client ID**

### 3. Criar Client IDs para cada plataforma

#### Android

1. Selecione **Android** como tipo de aplicação
2. Preencha:
   - **Package name**: Encontre em `app.json` (ex: `com.yourcompany.agapp`)
   - **SHA-1 certificate fingerprint**: Obtenha executando:
     ```bash
     cd android
     ./gradlew signingReport
     ```
     Ou para desenvolvimento:
     ```bash
     keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey
     # Senha padrão: android
     ```

#### iOS

1. Selecione **iOS** como tipo de aplicação
2. Preencha:
   - **Bundle ID**: Encontre em `app.json` (ex: `com.yourcompany.agapp`)

#### Web (OBRIGATÓRIO)

1. Selecione **Web application** como tipo de aplicação
2. **Nome**: AgilizaPro Web Client
3. Em **Authorized JavaScript origins**, NÃO é necessário adicionar nada
4. Em **Authorized redirect URIs**, adicione APENAS estas URIs (Google não aceita exp:// ou IPs):
   ```
   https://auth.expo.io/clausemberg/agapp
   https://agilizzapp-206f1.firebaseapp.com/__/auth/handler
   ```

   **IMPORTANTE**:
   - Google Cloud Console só aceita URLs HTTPS com domínios válidos (.com, .org, etc)
   - URIs como `exp://` ou `com.agilizapro.agapp://` NÃO são aceitas
   - Use apenas as duas URIs acima

**IMPORTANTE**: O `webClientId` e os redirect URIs são necessários para o `expo-auth-session` funcionar. Este Client ID é usado para autenticação e validação do token no backend.

### 4. Configurar Variáveis de Ambiente

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Adicione os Client IDs no arquivo `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id.apps.googleusercontent.com
   ```

### 5. Configurar Backend

No backend, adicione o Google Client ID (Web) no arquivo `.env`:

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Este é o mesmo Client ID usado para web no mobile.

### 6. Instalar Dependências

```bash
npm install
```

### 7. Testar

1. Inicie o app:
   ```bash
   npm start
   ```

2. Abra o app no dispositivo/emulador
3. Tente fazer login com Google
4. Você deverá ver a tela de consentimento do Google

## Notas Importantes

- **Desenvolvimento**: Use o Client ID Web para testar com Expo Go
- **Produção**: Compile um build standalone e use os Client IDs específicos da plataforma
- **SHA-1**: Para produção, use o SHA-1 do seu keystore de produção
- **Redirect URI**: O formato do Expo é `https://auth.expo.io/@username/slug`

## Troubleshooting

### Erro "idpiframe_initialization_failed"

- Verifique se os Client IDs estão corretos
- Confirme que o domínio está autorizado nas configurações OAuth

### Erro "unauthorized_client"

- Verifique se o Bundle ID/Package Name está correto
- Confirme que o SHA-1 está registrado (Android)
- Verifique se o OAuth consent screen está configurado

### Token inválido no backend

- Confirme que o `GOOGLE_CLIENT_ID` no backend está correto
- Verifique se o token não expirou
- Certifique-se de que está usando o mesmo Client ID web

## Recursos

- [Expo Auth Session Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
