# Implementation Plan (Simplified & Explicit)

> **Objetivo:** documento autoexplicativo para guiar qualquer modelo (mesmo muito limitado) na finalização do AgApp, cobrindo backlog atual, novos requisitos de testes, fidelidade visual e passos de QA/implantação.

---

## 0. Premissas Gerais
- **Fidelidade visual**: toda nova tela/ajuste deve seguir exatamente a identidade atual (cores, tipografia, gradientes, ícones).
- **Stack vigente**: FastAPI + MongoDB (Motor) no backend, Expo React Native + Zustand no mobile.
- **Escopo funcional**: marketplace de serviços onde clientes publicam projetos e profissionais consomem créditos para obter leads.

---

## 1. Autenticação & Perfis
- ✅ Login com e-mail/senha + Cloudflare Turnstile.
- ✅ Login com Google (native GSI).
- ✅ Seleção de papel (cliente/profissional) e tela de anúncios antes da home.
- 🔜 Garantir revalidação quando o token expira (logout/silent refresh) e documentar configuração de Turnstile + Google.

---

## 2. Cadastro de Clientes & Projetos
- ✅ Fluxo de signup/complete-profile com CPF/telefone.
- ✅ Criação de projeto com título, descrição, orçamento, localização (mapa + endereço manual).
- 🔜 Avaliar se precisa upload de fotos ou anexos durante criação.
- 🔜 Adicionar opção “destacar projeto” no ato de criação (ver seção 7).

---

## 3. Descoberta de Projetos para Profissionais
- ✅ Listagem de projetos próximos (`projectsNearbyStore` + `/projects/nearby/combined`).
- ✅ Filtro para remotos vs presenciais.
- 🔜 Ordenação por destaque/urgência/tempo.
- 🔜 Mostrar badges (novo, destacado, prestes a expirar).

---

## 4. Contato (Lead) & Créditos Dinâmicos
- ✅ Endpoint `/contacts/{project_id}` cria contato, valida papel e desconta 1 crédito.
- ✅ Push ao cliente quando recebe novo contato.
- 🔜 Implementar preços variáveis:
  - Projetos inéditos: 3 créditos (0–24h), 2 créditos (24–36h), 1 crédito (36–48h).
  - Projetos com contato prévio: 2 créditos nas primeiras 24h após 1º contato, 1 crédito depois.
  - Registrar transações individuais com o valor usado.
- 🔜 Adicionar **locking** (ex.: `findOneAndUpdate`) para impedir dois profissionais pegarem o mesmo lead simultaneamente.
- 🔜 Exibir custo previsto e saldo antes de confirmar contato no mobile.

---

## 5. Chat em Tempo Real + Push
- ✅ WebSocket `/ws/{user_id}` e endpoint REST `/contacts/{id}/messages`.
- 🔜 Implementar UI de chat no app (cliente e profissional) com:
  - Lista de mensagens (timestamp, autor).
  - Input com envio pelo WebSocket e fallback REST.
- 🔜 Push notifications bi-direcionais quando novas mensagens chegarem.
- 🔜 Ao iniciar chat, marcar lead como “em conversação” no backend.

---

## 6. Conclusão e Avaliação do Serviço
- ✅ Backend possui `/projects/{id}/close` e `/projects/{id}/evaluate`.
- 🔜 Mobile cliente:
  - Botão “Marcar como concluído” (quando houver contato ativo).
  - Form para valor final + seleção do profissional vencedor.
- 🔜 Mobile avaliação:
  - Modal para nota 1–5 + comentário.
  - Feedback visual após envio.
- 🔜 Backend: garantir que conclusão/avaliação atualizem ranking e histórico.

---

## 7. Projeto Destacado (Urgência Paga)
- ✅ Endpoints `/api/payments/featured-project` com Asaas (PIX/cartão).
- 🔜 Mobile cliente:
  - CTA “Destacar projeto” (em criar/editar/detalhe).
  - Fluxo de pagamento (ver seção 8).
- 🔜 Mobile profissional: badge “Destacado” e prioridade na listagem.
- 🔜 Garantir job/cron para remover `is_featured` após `featured_until`.

---

## 8. Créditos, Pacotes e Assinaturas
- ✅ APIs para pacotes (`/api/payments/credit-packages`) e assinaturas (`/api/payments/subscription`).
- 🔜 Mobile:
  - Tela “Meus créditos” (saldo + histórico).
  - Loja de pacotes (PIX ou cartão) com QRCode/link.
  - Tela de assinatura (listar planos, contratar, cancelar, mostrar status).
- 🔜 Backend: revisar webhooks Asaas e garantir atualização automática de créditos/renovações.
- 🔜 Documentação operacional (como criar planos, cancelar manualmente etc.).

---

## 9. Ads & Tela Inicial
- ✅ Upload e APIs de anúncios (HTML/CSS/JS/imagens) para 4 slots.
- ✅ `BannerAd` e `AdScreen` com cache local.
- 🔜 Corrigir rotas divergentes (`/system-admin/api/public/ads/{adType}` vs `/ads/public/...`).
- 🔜 Implementar tracking real usando `/ads/public/click/{location}` (gravar métricas).
- 🔜 (Opcional) Relatórios de impressões/cliques no painel admin.

---

## 10. Registro Analítico & Ranking
- ✅ Dados básicos já existem (projeto, contatos, avaliações).
- 🔜 Criar “lead_events” (timestamps para criação, contato, chat, conclusão).
- 🔜 Painel admin: dashboards por profissional (leads, fechamentos, notas).
- 🔜 Mobile profissional: enriquecer cartão de estatísticas (taxa de resposta, leads válidos).
- 🔜 Usar métricas para badges/níveis de reputação.

---

## 11. Suporte (Tickets via WebSocket)
- ✅ Backend `support.py` + WebSocket para tickets.
- 🔜 Mobile cliente/profissional:
  - Tela “Suporte” (listar tickets, abrir novo, chat).
  - Notificações (push) quando atendente responde.
- 🔜 Atendente/admin: garantir UI ou endpoints consumíveis para monitorar tickets.
- 🔜 Rating pós-atendimento (já previsto) deve ser incentivado.

---

## 12. Auditoria & Logs
- 🔜 Middleware de log para endpoints críticos (auth, pagamentos, contatos).
- 🔜 Guardar snapshots de termos/contratos aceitos.
- 🔜 Exportar logs (ex.: para S3) se necessário.

---

## 13. Checklist de QA / Go-Live
1. Configurar `.env` com todas as chaves (Turnstile, Google, Firebase, Asaas, storage).
2. Rodar seeds (categorias, planos, pacotes, anúncios default).
3. **Testar manualmente**:
   - Cadastro cliente + criação de projeto.
   - Profissional encontrando e pegando lead com créditos variáveis.
   - Chat + push bidirecional.
   - Concluir projeto + avaliar profissional.
   - Compra de créditos e assinatura (PIX + cartão).
   - Destacar projeto e confirmar expiração.
   - Tickets de suporte (cliente ↔ atendente).
   - Ads carregando offline (cache) e tracking.
4. Configurar alertas/logs para Asaas, WebSocket e push.
5. Documentar manuais internos (admin, suporte, financeiro) e FAQ para usuários.

---

## 14. Testes Automatizados (Do Zero)

### 14.1 Backend – FastAPI
- Ferramentas: `pytest`, `pytest-asyncio`, `httpx`, fixtures Mongo isoladas.
- Suites propostas:
  1. **Auth**: login Turnstile/Google (mock), refresh/logout.
  2. **Projects**: criar/editar, filtros e geocode mockado.
  3. **Contacts e créditos**: regras 3/2/1, locking, chat REST/WebSocket (mock manager), push mock.
  4. **Payments**: planos, pacotes, destaque (mock Asaas), webhooks.
  5. **Support**: tickets, mensagens, rating, permissões atendente.
- Incluir estes jobs no GitHub Actions.

### 14.2 Mobile – React Native / Expo
- **Jest + Testing Library** para componentes/hooks/stores (reconfigurar do zero).
- **Instrumentação Android**:
  - Criar projeto `android/` (via `expo prebuild` se necessário).
  - Adicionar Espresso + Mockito.
  - Casos: login (Turnstile stub), seleção de perfil + anúncio, criação de projeto, fluxo de contato, chat, compra de créditos (mock API), suporte.
  - Rodar `./gradlew connectedAndroidTest`.
- Manual para rodar testes:
  - Backend: `pytest`.
  - Mobile JS: `npm test`.
  - Mobile Android: `cd android && ./gradlew connectedAndroidTest`.
- Integrar no CI (Jest + `connectedAndroidTest` em emulator, ao menos nightly).

---

## 15. Fidelidade Visual (Reforço)
- Qualquer nova tela ou ajuste deve reutilizar:
  - Paleta já definida (`colors.ts` / theme Paper).
  - Gradientes, ícones e tipografia existentes.
  - Componentes compartilhados (botões, cards, avatars) para manter consistência.

---

## 16. Próximos Passos Recomendados
1. Priorizar implementação das regras de créditos (item 4) e do chat (item 5), pois destravam monetização e fidelização.
2. Em paralelo, iniciar loja de créditos/assinaturas (item 8) e destaque (item 7).
3. Depois, concluir suporte, analytics e ranking (itens 10 e 11).
4. Finalizar com suíte de testes e pipeline CI/CD (item 14) → garante qualidade contínua.

---

> **Resumo**: este plano serve como guia único para todos os times (backend, mobile, QA). Siga cada seção em ordem ou conforme priorização acordada. Lembre-se de manter o visual atual em qualquer entrega e de atualizar os testes sempre que novas regras forem introduzidas.

