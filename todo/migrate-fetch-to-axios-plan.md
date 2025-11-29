# Plano: Migrar todas as chamadas fetch -> axios

Objetivo: consolidar as chamadas HTTP no mobile para usar `axios` (melhor ergonomia, interceptors para auth/refresh, timeouts nativos, baseURL e retries), mantendo o mínimo de alteração em cada arquivo até a fase final.

Por quê?
- `axios` facilita interceptors (auth token, refresh), timeout e reuso da instância.
- Facilita testes e debug com interceptors e logging.

Escopo:
- Mobile: `mobile/src/**` (todas as chamadas `fetch` encontradas)
- Não vamos migrar código em `backend/` (FastAPI Python) nem docs nem venv.

Plano passo-a-passo

1. Preparação - Branch e dependências
   - Criar branch: `feature/mobile/migrate-fetch-to-axios`.
   - Instalar dependências no mobile: `axios`, `axios-retry`, `@types/axios` (opcional para TS).

2. Criar `axios` client compartilhado
   - Criar arquivo `mobile/src/api/axiosClient.ts` com:
     - baseURL via env `BACKEND_URL`.
     - timeout padrão.
     - request interceptor para inserir `Authorization: Bearer <token>` usando `useAuthStore` ou um helper `getToken()` importado.
     - response interceptor para tratar 401 -> tentar refresh token (se o app já tem um endpoint refresh) e retry original request.
   - Expor `client` (axios instance) e funções helper como `api.get`, `api.post`, etc or export `client` directly.
   - Documentar o padrão de uso (ex.: `const { data } = await client.get('/users/me')`).

3. Criar wrappers (opcional mas recomendado)
   - `mobile/src/api/index.ts`:
     - `export const api = { get: (path, opts) => client.get(path, opts), post: (...) }` - ajuda manter compatibilidade com fetch semantics.
     - mapear erro e payload para ficar parecido com `fetch`, ou documente mudanças.

4. Migrate files (manual, 1 arquivo por PR if prefer)
   - Para cada arquivo listado no `todo/migrate-fetch-to-axios-list.md`, atualizar:
     - `fetch(url, { method, headers, body })` -> `client.<method>(url, body, { headers })` ou `client.request({ url, method, data, headers })`.
     - Normalmente `fetch` usa `res.json()`; em axios, resposta JSON já em `res.data`.
     - Ajustar tratamento de erros (axios rejeita promise em status >= 400).
     - Replace `res.ok` checks with try/catch of axios or `if (res.status >= 400) throw new Error()`.

5. Testes (local) e validação manual
   - Start backend (docker compose dev) and mobile app.
   - Test flows: login, profile, ads, webview, upload, payment.
   - Detailed verify: token is sent in header by interceptor, 401 flows refresh token.

6. CI / Lint / Fixes
   - Run tests, ensure types compile.
   - Adjust lint rules if necessary.

7. Optional: Integrate react-query or similar • Improve caching
   - If you want caching etc, migrate some API calls to react-query with axios as the fetcher.

8. Cleanup & Docs
   - Update `README-local.md` with new dependency install steps and notes about axios.
   - Remove any direct `fetch` occurrences left (except in docs or tests).

Rolling Out (recommended):
- Do the migration in small PRs (1-5 files per PR) to reduce risk.
- Add feature flags if needed.

---
Notas: se você preferir, eu já crio o client e troco os arquivos mais importantes (auth, login) em uma PR piloto para avaliar o impacto antes de migrar tudo.