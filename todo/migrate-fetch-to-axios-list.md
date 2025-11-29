# Lista de arquivos que usam `fetch()` (mobile)

Localizei os usos de `fetch(` na pasta `mobile/src/`. Esses arquivos devem ser revisados e migrados para `axios`.

- mobile/src/api/auth.ts  (login/register/google/me/fcm/complete-profile)
- mobile/src/hooks/useAd.ts  (check & fetch ad data)
- mobile/src/components/AdBanner.tsx  (fetch ad json + post click)
- mobile/src/screens/AdScreen.tsx  (fetch ad render & post click)
- mobile/src/screens/LoginScreen.tsx  (check ad + Google userinfo fallback)

> Nota: Também existem usos de `fetch` em `backend/ADS_API_DOCS.md` (exemplos de documentação), não precisará migrar.

Recomendações:
- Priorizar `api/auth.ts` e `LoginScreen.tsx` (login flow), depois `useAd.ts` e `AdScreen`.
- Criar `mobile/src/api/axiosClient.ts` e usar `export default client`.

---
Arquivo gerado automaticamente em $(date) por script de busca.
