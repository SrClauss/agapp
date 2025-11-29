# Dependências para migrar fetch -> axios (mobile)

Essas dependências devem ser instaladas no diretório `mobile/` (execute `cd mobile && npm i ...` ou `yarn add ...`).

## Dependências principais
- axios - cliente HTTP robusto
  - npm: `npm install axios`
  - yarn: `yarn add axios`

- axios-retry (opcional) - implementar políticas de retry automáticas
  - npm: `npm install axios-retry`
  - yarn: `yarn add axios-retry`

- @types/axios (opcional, se usar TypeScript para tipagem)
  - npm: `npm install -D @types/axios`
  - yarn: `yarn add -D @types/axios`

## Ferramentas e libs relacionadas (opcionais)
- react-query (TanStack Query) - gerenciar cache/requests/fetching/invalidates
  - `npm install @tanstack/react-query`

- abortcontroller-polyfill (se precisar suportar cancelamento em navegadores antigos) - não normalmente necessário no RN
  - `npm install abortcontroller-polyfill`

- qs (query string) - para serializar parâmetros complexos
  - `npm install qs`

## Comandos de instalação sugeridos
No diretório mobile:

```bash
npm install axios axios-retry
# dependências dev (opcional)
npm install -D @types/axios

# opcional: react-query
npm install @tanstack/react-query
```

## Observações de plataforma
- O React Native já tem `fetch` implementado; usar `axios` é uma dependência adicional, mas traz interceptors e facilidades.
- Se usar `axios` com upload progress em RN, pode haver detalhes (use `axios` com `FormData`).
- Para autenticação segura, continue usando `expo-secure-store` ou `react-native-keychain` (já no projeto).


---
Referências: https://axios-http.com, https://www.npmjs.com/package/axios-retry, https://tanstack.com/query/latest/docs/react/overview