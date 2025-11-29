# TODO (Backlog)

Este arquivo lista as tarefas em backlog relacionadas ao projeto. A intenção é centralizar pontos que você pediu para deixar para depois.

## Prioridade Alta

- [ ] Migrar `SafeAreaView` para `react-native-safe-area-context` no `AdScreen` (mobile)
  - Subtarefa: Instalar `react-native-safe-area-context` (ou `expo install`) se ainda não estiver.
  - Subtarefa: Envolver App com `SafeAreaProvider` em `App.tsx`.
  - Subtarefa: Usar `SafeAreaView` do `react-native-safe-area-context` e `useSafeAreaInsets()`.
  - Subtarefa: Ajustar `closeButton` posicionado com `top: insets.top + 12` e `right: insets.right + 12`.
  - Observação: Evitar `source .env` dentro de scripts para segurança.

- [ ] Fazer o WebView ocupar toda a altura do handler (full-screen), mantendo o `closeButton` overlay discreto
  - Subtarefa: Ajustes de estilo para `z-index`, `elevation` para Android e `shadow` para iOS.
  - Subtarefa: Garantir que o `closeButton` esteja fora do conteúdo do ad (overlay absoluto).
  - Subtarefa: Testes em Android/iOS, incluindo dispositivos com notch e gestos.

## Prioridade Média

- [ ] Melhorar e consolidar endpoints mobile de ad:
  - `GET /ads/public/render/{location}` - já implementado, confirmar compatibilidade com `useAd` (mobile).
  - Considerar adicionar `accept: application/json` em endpoints com `GET /ads/{location}/index.html` se quiser manter compatibilidade.

- [ ] Segurança das Ads
  - Opção: aplicar `bleach` para sanitizar HTML antes de fornecer a mobile ou forçar SSR em Jinja com filtros seguros.
  - Considerar usar `iframe` sandbox para admin preview, ou aplicar CSP/SRI onde adequado.

## Prioridade Baixa

- [ ] Limpar artefatos de debug do repo
  - Remover `uvicorn_debug.pid`, `cookiejar` se forem arquivos de debug e adicioná-los em `.gitignore`.
  - Incluir instruções práticas no `README-local.md` sobre como rodar o backend localmente com Mongo (script `scripts/run_backend_local_with_mongo.sh` já criado).

- [ ] Documentar os Endpoints de Ads em `docs/API_REFERENCE.md` (ex.: mobile usage exemplos, JSON schema retornado)

## Observações/Notes
- As entradas acima refletem o backlog que você pediu para deixar para depois; quando for aplicar as mudanças, recomendo abrir uma branch `feature/mobile/safearea-adscreen` e trabalhar em PR para facilitar testes.
- Se quiser, eu crio a branch com um esqueleto de mudanças (sem build) quando autorizar.

---
Arquivado: 28/11/2025
