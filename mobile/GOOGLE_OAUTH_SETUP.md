# Configuração do Google OAuth

Este guia explica como configurar a autenticação com Google no aplicativo mobile.

## Pré-requisitos

1. Conta do Google Cloud Platform
2. Projeto criado no Google Cloud Console

## Passo a Passo

### 1. Criar Credenciais OAuth no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione ou crie um novo projeto
3. Navegue para **APIs & Services** > **Credentials**
4. Clique em **+ CREATE CREDENTIALS** > **OAuth client ID**

### 2. Configurar OAuth Consent Screen

1. Configure a tela de consentimento em **OAuth consent screen**
2. Escolha **External** se for para uso público
3. Preencha as informações obrigatórias:
   - App name
   - User support email
   - Developer contact information

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

#### Web (para Expo Go e desenvolvimento)

1. Selecione **Web application** como tipo de aplicação
2. Em **Authorized redirect URIs**, adicione:
   ```
   https://auth.expo.io/@your-expo-username/your-app-slug
   ```

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
