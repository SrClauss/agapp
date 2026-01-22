# Mobile Unit Tests Documentation

## Visão Geral

Este documento descreve a suíte de testes unitários para o aplicativo mobile React Native do AgApp.

## Configuração

### Dependências de Teste

```json
{
  "@testing-library/jest-native": "^5.4.3",
  "@testing-library/react-native": "^12.4.0",
  "@types/jest": "^29.5.11",
  "jest": "^29.7.0",
  "jest-expo": "^52.0.0",
  "react-test-renderer": "19.1.0"
}
```

### Arquivos de Configuração

- **jest.config.js**: Configuração principal do Jest
- **jest.setup.js**: Setup de mocks globais e configurações
- **__mocks__/**: Diretório com mocks de arquivos e módulos

## Estrutura de Testes

```
mobile/
├── __mocks__/
│   └── fileMock.js               # Mock para assets estáticos
├── jest.config.js                # Configuração Jest
├── jest.setup.js                 # Setup global
└── src/
    └── __tests__/
        ├── stores/                # Testes de Zustand stores
        │   └── authStore.test.ts
        ├── components/            # Testes de componentes React
        │   └── ProjectCard.test.tsx
        ├── hooks/                 # Testes de custom hooks
        ├── utils/                 # Testes de utilitários
        │   └── helpers.test.ts
        └── api/                   # Testes de API clients
```

## Cobertura de Testes

### Stores (Zustand)

#### authStore.test.ts
- ✅ Estado inicial (user null, token null)
- ✅ setAuth() define usuário e token
- ✅ logout() limpa usuário e token
- ✅ updateUser() atualiza dados parcialmente
- ✅ Persistência de token no SecureStore
- ✅ Remoção de token do SecureStore
- ✅ Múltiplos tipos de roles
- ✅ isAuthenticated derivado corretamente

**Total: 9 testes**

### Components (React Native)

#### ProjectCard.test.tsx
- ✅ Renderiza título do projeto
- ✅ Renderiza descrição do projeto
- ✅ Renderiza faixa de orçamento
- ✅ onPress callback funciona
- ✅ Badge "new" para projetos recentes
- ✅ Badge "featured" para projetos destacados
- ✅ Localização para projetos não-remotos
- ✅ Indicador "Remote" para projetos remotos
- ✅ Informações de categoria
- ✅ Nome do cliente
- ✅ Campos opcionais ausentes
- ✅ Não quebra com projeto null

**Total: 12 testes**

### Utils (Funções Utilitárias)

#### helpers.test.ts
- ✅ axiosClient configurado com baseURL
- ✅ Authorization header adicionado com token
- ✅ Retry configurado para falhas
- ✅ formatCurrency() formata valores
- ✅ formatCurrency() com valores negativos
- ✅ formatDate() formata datas
- ✅ formatDate() com ISO strings
- ✅ validateCPF() valida CPF correto
- ✅ validateCPF() invalida CPF incorreto
- ✅ validateEmail() valida email correto
- ✅ validateEmail() invalida email incorreto
- ✅ calculateDistance() calcula distância
- ✅ calculateDistance() retorna 0 para mesma localização
- ✅ truncateText() trunca texto longo
- ✅ truncateText() não trunca texto curto
- ✅ debounce() atrasa chamadas de função
- ✅ groupBy() agrupa array por chave
- ✅ sortByDate() ordena por data

**Total: 18 testes**

## Mocks Implementados

### Expo Modules

- **expo-secure-store**: Mock para armazenamento seguro
- **expo-notifications**: Mock para push notifications
- **expo-location**: Mock para geolocalização
- **@react-native-google-signin/google-signin**: Mock para login Google
- **react-native-maps**: Mock para componentes de mapa
- **@react-native-async-storage/async-storage**: Mock para AsyncStorage

### Bibliotecas

- **axios**: Mock para requisições HTTP
- **react-native-paper**: Mock para componentes UI

## Comandos de Teste

```bash
# Rodar todos os testes
npm test

# Rodar com watch mode
npm run test:watch

# Rodar com coverage
npm run test:coverage

# Rodar específico para CI
npm run test:ci
```

## Coverage Report

```bash
# Gerar relatório de coverage
npm run test:coverage

# Ver relatório HTML
open coverage/lcov-report/index.html
```

## Threshold de Coverage

Configurado em `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50
  }
}
```

## Boas Práticas

### 1. Nomear Testes Claramente

```typescript
it('should update user credits when payment is confirmed', () => {
  // teste
});
```

### 2. Usar beforeEach para Setup

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // reset state
});
```

### 3. Testar Casos de Erro

```typescript
it('should handle network error gracefully', async () => {
  mockedAxios.get.mockRejectedValue(new Error('Network error'));
  // teste comportamento de erro
});
```

### 4. Mock Apenas o Necessário

```typescript
// Bom: Mock específico
jest.mock('../../api/auth', () => ({
  login: jest.fn()
}));

// Evitar: Mock genérico demais
jest.mock('../../api');
```

### 5. Usar renderHook para Hooks

```typescript
import { renderHook, act } from '@testing-library/react-native';

const { result } = renderHook(() => useMyHook());
act(() => {
  result.current.doSomething();
});
```

## Troubleshooting

### Problema: "Cannot find module"

**Solução:** Verificar `moduleNameMapper` em jest.config.js

### Problema: "Timeout" em testes assíncronos

**Solução:** Aumentar timeout ou usar `waitFor()`

```typescript
await waitFor(() => {
  expect(result.current.data).toBeDefined();
}, { timeout: 5000 });
```

### Problema: "Invariant Violation" com React Native

**Solução:** Verificar se jest-expo preset está configurado

### Problema: Mocks não funcionam

**Solução:** Verificar ordem de imports e jest.resetModules()

## Próximos Passos

### Testes a Adicionar

- [ ] Testes para locationStore
- [ ] Testes para projectsNearbyStore
- [ ] Testes para settingsStore
- [ ] Testes para hooks customizados (useAd, etc)
- [ ] Testes para mais componentes (AdBanner, CategoryGrid, etc)
- [ ] Testes para API clients (projects, contacts, payments)
- [ ] Testes de integração com React Navigation
- [ ] Snapshot tests para componentes complexos

### Melhorias

- [ ] Adicionar testes de acessibilidade
- [ ] Implementar visual regression tests
- [ ] Adicionar testes de performance
- [ ] Configurar Detox para E2E tests

## Integração Contínua

Os testes mobile são executados automaticamente no GitHub Actions via workflow `ios-build.yml`:

```yaml
- name: Run JavaScript tests
  run: npm test -- --ci --coverage --maxWorkers=2
```

## Recursos

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [jest-expo](https://docs.expo.dev/guides/testing-with-jest/)
- [Testing React Hooks](https://react-hooks-testing-library.com/)

## Suporte

Para dúvidas sobre os testes:
1. Consultar esta documentação
2. Ver exemplos em `src/__tests__/`
3. Verificar jest.setup.js para mocks disponíveis
