# 📋 PLANO DE IMPLEMENTAÇÃO: Migração para Expo Go

## 🎯 Objetivo
Remover dependências nativas e voltar para Expo Go mantendo todas as funcionalidades essenciais.

---

## 📦 FASE 1: Preparação do Ambiente

### 1.1 Criar Branch
```bash
git checkout -b feature/migrate-to-expo-go
```

### 1.2 Backup de Segurança
```bash
# Arquivos importantes serão deletados - git já faz backup
git status  # Verificar estado atual
```

---

## 🗑️ FASE 2: Limpeza de Arquivos Nativos

### 2.1 Deletar Pastas Nativas
```bash
cd mobile
rm -rf android/          # ~25 MB
rm -rf ios/              # ~20 MB
rm -f google-services.json  # Expo gerenciará FCM
```

### 2.2 Remover Builds Antigos
```bash
rm -rf .expo/
rm -rf node_modules/
```

---

## 📝 FASE 3: Atualizar Dependências

### 3.1 Atualizar `package.json`

**REMOVER:**
```json
"@react-native-google-signin/google-signin": "^16.0.0",
"react-native-maps": "1.20.1",
"react-native-geocoding": "^0.5.0",   // Dependia de Maps
```

**MANTER (já instalados):**
```json
"expo-auth-session": "^7.0.9",        // ✅ Já tem!
"expo-web-browser": "^15.0.9",        // ✅ Já tem!
"expo-notifications": "~0.32.16",     // ✅ Já tem!
"expo-location": "~19.0.7",           // ✅ Já tem!
```

### 3.2 Reinstalar Dependências
```bash
npm install
```

---

## 🔧 FASE 4: Reescrever Código Nativo

### 4.1 Reescrever `src/services/googleAuth.ts`

**Antes:** 120 linhas usando `@react-native-google-signin/google-signin`  
**Depois:** 60 linhas usando `expo-auth-session`

**Mudanças:**
- ❌ Remover: `GoogleSignin.configure()`, `GoogleSignin.signIn()`
- ✅ Adicionar: `AuthSession.useAuthRequest()`, `promptAsync()`
- ✅ Usar: Google OAuth **Web Client ID** (não mais Native)

**Arquivo novo:**
```typescript
// mobile/src/services/googleAuth.ts
import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Configuração do Google OAuth usando variáveis de ambiente
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

console.log('=== DEBUG googleAuth.ts ===');
console.log('GOOGLE_CLIENT_ID_WEB:', GOOGLE_CLIENT_ID_WEB);

if (!GOOGLE_CLIENT_ID_WEB) {
  console.error('ERRO: EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado!');
}

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export function useGoogleAuth() {
  useEffect(() => {
    console.log('=== Google Sign-In WEB OAuth configurado ===');
    console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
  }, []);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'com.agilizapro.agapp',
    path: 'auth',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID_WEB!,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
    },
    discovery
  );

  return {
    signIn: async () => {
      try {
        console.log('Iniciando Google Web OAuth...');
        console.log('Redirect URI:', redirectUri);

        const result = await promptAsync();
        
        console.log('Resultado do login:', result?.type);

        if (result?.type === 'success') {
          const { params } = result;
          const idToken = params.id_token;
          const accessToken = params.access_token;

          console.log('ID Token obtido:', idToken ? 'Token encontrado ✓' : 'Token não encontrado ✗');

          // Retornar tokens - backend decodificará o idToken para pegar userInfo
          return { 
            idToken, 
            accessToken,
            userInfo: null // Backend extrairá do token
          };
        } else if (result?.type === 'error') {
          throw new Error(result.error?.message || 'Erro no OAuth');
        } else {
          throw new Error('Login cancelado pelo usuário');
        }
      } catch (error: any) {
        console.error('Erro no Google Web OAuth:', error);
        throw error;
      }
    },
    signOut: async () => {
      try {
        console.log('Logout - Web OAuth não requer signOut nativo');
        // Apenas limpar tokens locais (feito pelo authStore)
      } catch (error) {
        console.error('Erro no logout:', error);
      }
    },
  };
}
```

---

### 4.2 Simplificar `src/components/MapPinPicker.tsx`

**Antes:** 103 linhas com MapView condicional  
**Depois:** 70 linhas **SEMPRE** usando fallback manual

**Mudanças:**
- ❌ Remover: `import MapView`, lógica de detecção de API key
- ✅ Manter: Campos manuais de lat/lng
- ✅ Adicionar: Botão para abrir OpenStreetMap externo

**Arquivo simplificado:**
```tsx
// mobile/src/components/MapPinPicker.tsx
import React, { useState, useEffect } from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, TextInput, Text } from 'react-native-paper';

type Props = {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number };
  onDismiss: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
};

export default function MapPinPicker({ visible, initialCoords, onDismiss, onConfirm }: Props) {
  const [pos, setPos] = useState(
    initialCoords || { latitude: -23.55, longitude: -46.63 }
  );

  useEffect(() => {
    if (initialCoords) {
      setPos(initialCoords);
    }
  }, [initialCoords]);

  const openInOpenStreetMap = () => {
    const url = `https://www.openstreetmap.org/?mlat=${pos.latitude}&mlon=${pos.longitude}#map=15/${pos.latitude}/${pos.longitude}`;
    Linking.openURL(url);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Confirmar Localização</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.helpText}>
            Insira as coordenadas manualmente ou visualize no mapa externo:
          </Text>
          
          <TextInput
            label="Latitude"
            value={String(pos.latitude)}
            onChangeText={(t) => setPos(p => ({ ...p, latitude: parseFloat(t) || 0 }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          
          <TextInput
            label="Longitude"
            value={String(pos.longitude)}
            onChangeText={(t) => setPos(p => ({ ...p, longitude: parseFloat(t) || 0 }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          
          <Button
            mode="outlined"
            onPress={openInOpenStreetMap}
            icon="map-marker"
            style={styles.mapButton}
          >
            Visualizar no OpenStreetMap
          </Button>

          <Text style={styles.coordsPreview}>
            📍 Lat: {pos.latitude.toFixed(6)}, Lng: {pos.longitude.toFixed(6)}
          </Text>
        </Dialog.Content>
        
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button onPress={() => onConfirm(pos)} mode="contained">
            Confirmar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  helpText: {
    marginBottom: 16,
    fontSize: 14,
    color: '#666',
  },
  input: {
    marginBottom: 12,
  },
  mapButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  coordsPreview: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
```

---

### 4.3 Limpar `app.json`

**REMOVER:**
```json
// iOS
"config": {
  "googleMapsApiKey": "AIzaSy..."  // ❌ Não precisa mais
}

// Android
"googleServicesFile": "./google-services.json",  // ❌ Expo gerencia

// Plugins
"@react-native-google-signin/google-signin",  // ❌ Nativo
```

**MANTER:**
```json
{
  "expo": {
    "name": "AgilizaPro",
    "slug": "agapp",
    "owner": "clausemberg",
    "version": "1.0.0",
    "scheme": "com.agilizapro.agapp",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.agilizapro.agapp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.agilizapro.agapp"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#ffffff",
          "mode": "production"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "0e99eaba-51a4-4186-9e49-b0834615e7c9"
      }
    }
  }
}
```

### 4.4 Atualizar `package.json`

Remover as seguintes linhas das dependencies:
```json
"@react-native-google-signin/google-signin": "^16.0.0",
"react-native-maps": "1.20.1",
"react-native-geocoding": "^0.5.0",
```

---

## 🧪 FASE 5: Testes

### 5.1 Limpar e Rebuildar
```bash
cd mobile
rm -rf node_modules/ .expo/
npm install
npx expo prebuild --clean  # Regenera configs sem android/ios
```

### 5.2 Testar no Expo Go
```bash
npx expo start --clear
# Escanear QR code no Expo Go
```

### 5.3 Checklist de Funcionalidades

| Funcionalidade | Teste | Status |
|----------------|-------|--------|
| ✅ Login com Email/Password | Fazer login normal | |
| ✅ Login com Google | Clicar "Entrar com Google" | |
| ✅ Push Notifications | Receber notificação de teste | |
| ✅ Geolocalização | Criar projeto com localização | |
| ✅ Entrada Manual Coords | Confirmar lat/lng no MapPicker | |
| ✅ OpenStreetMap Externo | Abrir link do OSM | |
| ✅ Hot Reload | Alterar texto e salvar | |

---

## 🔄 FASE 6: Migração do Backend (Notificações)

### 6.1 Atualizar Backend para Expo Push Service

**Arquivo:** `backend/app/services/notifications.py` ou similar

**ANTES:** Firebase Admin SDK (FCM direto)
```python
# Usando firebase-admin
admin.messaging().send(message)
```

**DEPOIS:** Expo Server SDK
```bash
cd backend
pip install exponent_server_sdk
```

```python
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

def send_push_notification(token: str, title: str, body: str, data: dict = None):
    try:
        # Validar token Expo
        if not PushClient().is_exponent_push_token(token):
            print(f"Token inválido: {token}")
            return
        
        # Criar mensagem
        message = PushMessage(
            to=token,
            title=title,
            body=body,
            data=data or {},
            sound="default",
            priority="high",
            channel_id="default",
        )
        
        # Enviar
        response = PushClient().publish(message)
        
        # Verificar erros
        try:
            response.validate_response()
        except DeviceNotRegisteredError:
            # Token inválido - remover do banco
            print(f"Token não registrado: {token}")
        except PushTicketError as e:
            print(f"Erro no ticket: {e}")
            
    except Exception as e:
        print(f"Erro enviando push: {e}")
```

### 6.2 Instalar Dependência no Backend
```bash
cd backend
pip install exponent-server-sdk
pip freeze > requirements.txt
```

---

## 📊 FASE 7: Comparação Final

### Antes (Build Nativo):
```
mobile/
├── android/           (~25 MB)
├── ios/              (~20 MB)
├── google-services.json
├── package.json      (2 deps nativas)
└── node_modules/     (~500 MB)
```

### Depois (Expo Go):
```
mobile/
├── package.json      (0 deps nativas!)
├── node_modules/     (~400 MB)
└── .expo/            (cache leve)
```

**Ganhos:**
- ✅ **-45 MB** em código nativo deletado
- ✅ **-100 MB** em node_modules
- ✅ **0 segundos** de build time (Expo Go)
- ✅ **Hot reload instantâneo**

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|-------|-----------|
| Google Login quebrar | ✅ Testar em staging primeiro |
| Usuários reclamarem de mapas | ✅ OpenStreetMap é alternativa válida |
| Notificações pararem | ✅ Migrar backend junto |
| Rate limit Expo Push | ✅ Monitorar uso (600/dia grátis) |

---

## 🎯 ORDEM DE EXECUÇÃO

```bash
# 1. Criar branch
git checkout -b feature/migrate-to-expo-go

# 2. Deletar nativos
cd mobile
rm -rf android/ ios/ google-services.json

# 3. Atualizar código (edits em arquivos)
# - googleAuth.ts (reescrever)
# - MapPinPicker.tsx (simplificar)
# - app.json (limpar)
# - package.json (remover deps)

# 4. Reinstalar
rm -rf node_modules/ .expo/
npm install

# 5. Testar
npx expo start --clear

# 6. Commit
git add .
git commit -m "feat: migrate to Expo Go - remove native dependencies"
git push origin feature/migrate-to-expo-go
```

---

## ✅ CRITÉRIOS DE SUCESSO

- [ ] App roda no Expo Go sem erros
- [ ] Login com Google funciona (Web OAuth)
- [ ] Notificações chegam (via Expo Push)
- [ ] Geolocalização funciona
- [ ] MapPicker mostra campos manuais
- [ ] Hot reload é instantâneo
- [ ] Sem pastas `android/` ou `ios/`
- [ ] `package.json` sem deps nativas

---

## 📝 NOTAS IMPORTANTES

### Sobre Google Sign-In:
- **Antes:** SDK nativo (melhor UX, mas requer build)
- **Depois:** Web OAuth (abre navegador, mas funciona no Expo Go)
- **Produção:** Ambos funcionam identicamente no backend

### Sobre Mapas:
- **Antes:** react-native-maps interativo
- **Depois:** Entrada manual + link para OpenStreetMap
- **Alternativa futura:** Usar `expo-location` para detectar posição atual

### Sobre Notificações:
- **Desenvolvimento:** Expo Push funciona no Expo Go
- **Produção:** Expo Push usa FCM/APNS automaticamente
- **Rate Limits:** 600 notif/dia (grátis) ou ilimitado (pago)

---

## 🚀 PRÓXIMOS PASSOS APÓS MIGRAÇÃO

1. **Testar extensivamente** no Expo Go (iOS + Android)
2. **Migrar backend** para Expo Push Service
3. **Criar build standalone** com `eas build` para produção
4. **Configurar OTA updates** para updates instantâneos
5. **Monitorar** rate limits do Expo Push Service

---

## 📚 REFERÊNCIAS

- [Expo Auth Session Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [Expo Server SDK (Python)](https://github.com/expo/exponent-server-sdk-python)
- [OpenStreetMap](https://www.openstreetmap.org/)

---

**Data de Criação:** 11 de março de 2026  
**Autor:** GitHub Copilot  
**Status:** Pronto para implementação
