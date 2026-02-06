# Sistema de Testes - Mobile Android

## 📝 Visão Geral

Este documento descreve o sistema completo de testes para o aplicativo mobile Android (React Native/Expo).

## 🎯 Estatísticas

- **Total de Testes**: 140 testes
- **Suites de Teste**: 15 suites
- **Taxa de Sucesso**: 100% (140/140 passando)

## 📊 Cobertura por Módulo

### ✅ Excelente Cobertura (> 80%)

#### Utils (87.07% linhas)
- ✅ **array.ts** - 100% - Funções de manipulação de arrays (groupBy, sortByDate, uniqueBy, chunk)
- ✅ **cpf.ts** - 100% - Validação completa de CPF com algoritmo
- ✅ **formatters.ts** - 100% - Formatação de moeda, datas, números, tempo relativo
- ✅ **geo.ts** - 100% - Cálculo de distância (Haversine), formatação de distâncias
- ✅ **helpers.ts** - 100% - Debounce, throttle, sleep, retry
- ✅ **roles.ts** - 100% - Roteamento baseado em papéis de usuário
- ✅ **text.ts** - 100% - Truncate, capitalize, slugify
- ✅ **validators.ts** - 100% - Validação de CPF, email, telefone, senha

#### API (Parcial)
- ✅ **contacts.ts** - Testado - Preview de custo, criação de contato, mensagens
- ✅ **auth.ts** - Testado - Login, signup, Google, FCM, complete profile
- ✅ **users.ts** - 100% - Settings profissionais, usuário público

#### Stores (31.44% linhas)
- ✅ **locationStore.ts** - 91.3% - Gerenciamento de localização
- ✅ **authStore.ts** - 56.86% - Autenticação e persistência

### ⚠️ Sem Cobertura (0%)

#### API
- ⚠️ **projects.ts** - Criar, atualizar, listar projetos
- ⚠️ **payments.ts** - Pagamentos e créditos
- ⚠️ **professional.ts** - Stats e dados profissionais
- ⚠️ **categories.ts** - Categorias de serviços

#### Stores
- ⚠️ **notificationStore.ts** - Gerenciamento de notificações
- ⚠️ **projectsNearbyStore.ts** - Projetos próximos
- ⚠️ **settingsStore.ts** - Configurações do app

#### Services
- ⚠️ **googleAuth.ts** - Autenticação Google
- ⚠️ **location.ts** - Serviços de localização
- ⚠️ **notifications.ts** - Push notifications
- ⚠️ **websocket.ts** - Comunicação em tempo real

#### Components
- ⚠️ Todos os componentes UI (0.35%)

#### Screens
- ⚠️ Todas as telas (0%)

## 🧪 Tipos de Testes

### 1. Testes de Unidade (Unit Tests)

#### Utils Tests (66 testes)
```bash
# Validadores
src/__tests__/utils/validators.test.ts (21 testes)
- validateCPF, validateEmail, validatePhone, validatePassword

# Formatadores  
src/__tests__/utils/formatters.test.ts (12 testes)
- formatCurrency, formatDate, formatNumber, formatRelativeTime

# CPF
src/__tests__/utils/cpf.test.ts (7 testes)
- onlyDigits, isValidCPF (com algoritmo completo)

# Roles
src/__tests__/utils/roles.test.ts (6 testes)
- getRouteForRoles (navegação baseada em papéis)

# Geo
src/__tests__/utils/geo.test.ts (6 testes)
- calculateDistance (Haversine), formatDistance

# Text
src/__tests__/utils/text.test.ts (8 testes)
- truncateText, capitalizeFirstLetter, slugify

# Array
src/__tests__/utils/array.test.ts (12 testes)
- groupBy, sortByDate, uniqueBy, chunk

# Helpers
src/__tests__/utils/helpers.test.ts (11 testes)
- debounce, throttle, sleep, retry
```

#### API Tests (55 testes)
```bash
# Auth API
src/__tests__/api/auth.test.ts (21 testes)
- loginWithEmail, signUpWithEmail, loginWithGoogle
- fetchCurrentUser, registerFcmToken, completeProfile

# Users API
src/__tests__/api/users.test.ts (6 testes)
- getProfessionalSettings, updateProfessionalSettings, getUserPublic

# Contacts API
src/__tests__/api/contacts.test.ts (28 testes)
- getContactCostPreview, createContactForProject, sendContactMessage
```

### 2. Testes de Estado (State Management)

#### Zustand Stores (17 testes)
```bash
# Auth Store
src/__tests__/stores/authStore.test.ts (11 testes)
- setToken, setUser, setActiveRole, logout
- Persistência com expo-secure-store

# Location Store
src/__tests__/stores/locationStore.test.ts (8 testes)
- setLocation, clear, fetchLocation
- Permissões, geocoding, tratamento de erros
```

### 3. Testes de Componentes

#### Components Tests (1 teste)
```bash
# ProfessionalStatsCard
__tests__/ProfessionalStatsCard.test.tsx (1 teste)
- Renderização e exibição de créditos
```

## 🚀 Como Executar os Testes

### Comandos Disponíveis

```bash
# Executar todos os testes
npm test

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Executar com relatório de cobertura
npm run test:coverage

# Executar para CI/CD
npm run test:ci
```

### Executar Testes Específicos

```bash
# Executar um arquivo específico
npm test -- validators.test.ts

# Executar testes que correspondem a um padrão
npm test -- utils

# Executar um teste específico
npm test -- -t "should validate correct emails"
```

## 🔧 Configuração

### Jest Config (`jest.config.js`)

```javascript
{
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|...))'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
}
```

### Setup (`jest.setup.js`)

Configuração de mocks globais:
- React Native dev flag
- Batched bridge config
- TurboModuleRegistry
- AsyncStorage
- SecureStore
- Console silencing

## 📱 Testes para Android

### Pré-requisitos

1. Node.js 18+ instalado
2. Dependências instaladas: `npm install`
3. Android SDK configurado (para testes E2E)

### Executar Testes

```bash
# Testes unitários e integração (Jest)
cd mobile
npm install
npm test

# Com cobertura
npm run test:coverage

# Modo watch para desenvolvimento
npm run test:watch
```

### Estrutura de Diretórios

```
mobile/
├── __tests__/              # Testes de componentes principais
│   └── ProfessionalStatsCard.test.tsx
├── src/
│   └── __tests__/
│       ├── api/           # Testes de API
│       │   ├── auth.test.ts
│       │   ├── contacts.test.ts
│       │   └── users.test.ts
│       ├── stores/        # Testes de stores
│       │   ├── authStore.test.ts
│       │   └── locationStore.test.ts
│       └── utils/         # Testes de utilidades
│           ├── array.test.ts
│           ├── cpf.test.ts
│           ├── formatters.test.ts
│           ├── geo.test.ts
│           ├── helpers.test.ts
│           ├── roles.test.ts
│           ├── text.test.ts
│           ├── utils.test.ts
│           └── validators.test.ts
├── jest.config.js         # Configuração do Jest
└── jest.setup.js          # Setup global de testes
```

## 🎓 Guia de Boas Práticas

### 1. Estrutura de Teste

```typescript
describe('ModuleName', () => {
  // Setup global
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('functionName', () => {
    it('should do something expected', () => {
      // Arrange (preparar)
      const input = 'test';
      
      // Act (executar)
      const result = myFunction(input);
      
      // Assert (verificar)
      expect(result).toBe('expected');
    });
  });
});
```

### 2. Mocking

```typescript
// Mock de módulo
jest.mock('../api/axiosClient');

// Mock de função específica
const mockFn = jest.fn().mockResolvedValue('result');

// Verificar chamadas
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(1);
```

### 3. Testes Assíncronos

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

it('should reject on error', async () => {
  await expect(failingFunction()).rejects.toThrow('Error');
});
```

### 4. Testing de Stores (Zustand)

```typescript
import { renderHook, act } from '@testing-library/react-native';

it('should update store state', () => {
  const { result } = renderHook(() => useMyStore());
  
  act(() => {
    result.current.updateValue('new value');
  });
  
  expect(result.current.value).toBe('new value');
});
```

## 📈 Melhorias Futuras

### Próximos Passos

1. ✅ **Testes de API** - Adicionar testes para:
   - projects.ts
   - payments.ts
   - professional.ts
   - categories.ts

2. ✅ **Testes de Stores** - Completar cobertura de:
   - notificationStore.ts
   - projectsNearbyStore.ts
   - settingsStore.ts

3. ✅ **Testes de Services** - Adicionar testes para:
   - googleAuth.ts
   - location.ts
   - notifications.ts
   - websocket.ts

4. ✅ **Testes de Componentes** - Testar componentes principais:
   - ProjectCard
   - CategoryGrid
   - ConfirmContactModal
   - EvaluationModal

5. ✅ **Testes E2E** (End-to-End):
   - Fluxo de login
   - Criação de projeto
   - Busca de projetos
   - Sistema de contatos

### Meta de Cobertura

- **Atual**: 8.41% linhas globais
- **Meta Intermediária**: 50% (configurado no jest.config.js)
- **Meta Final**: 80% para módulos críticos

## 🐛 Debugging

### Executar com Logs Detalhados

```bash
# Modo verbose
npm test -- --verbose

# Logs de console no teste
npm test -- --silent=false

# Executar um único teste
npm test -- -t "nome do teste"
```

### Problemas Comuns

1. **Erro de transformIgnorePatterns**
   - Adicionar o módulo no jest.config.js

2. **Timeout em testes assíncronos**
   - Aumentar timeout: `jest.setTimeout(10000)`

3. **Mocks não funcionando**
   - Verificar ordem de imports
   - Limpar mocks entre testes: `jest.clearAllMocks()`

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Zustand](https://docs.pmnd.rs/zustand/guides/testing)
- [Expo Testing](https://docs.expo.dev/develop/unit-testing/)

## 🤝 Contribuindo

Ao adicionar novas funcionalidades:

1. ✅ Escrever testes primeiro (TDD)
2. ✅ Manter cobertura > 80% para novos módulos
3. ✅ Documentar casos de teste complexos
4. ✅ Verificar que todos os testes passam: `npm test`
5. ✅ Gerar relatório de cobertura: `npm run test:coverage`

---

**Última Atualização**: 2026-02-06
**Versão**: 1.0.0
