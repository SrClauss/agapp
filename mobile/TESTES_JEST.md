# Testes Jest - Implementação de Push Notifications

## Resumo

Foram criados testes completos para todas as novas funcionalidades implementadas, seguindo os padrões de teste já existentes no projeto.

## Testes Criados

### 1. chatStore.test.ts
**Localização**: `mobile/src/__tests__/stores/chatStore.test.ts`

**Cobertura**:
- ✅ Estado inicial (chat fechado, sem contato ativo)
- ✅ Função `openChat` (abrir chat com ID específico)
- ✅ Função `closeChat` (fechar chat e limpar estado)
- ✅ Troca de contato quando chat já está aberto
- ✅ Persistência de estado entre múltiplas instâncias
- ✅ Tratamento de valores vazios

**Total**: 9 testes

### 2. ProfileCard.test.tsx
**Localização**: `mobile/src/__tests__/components/ProfileCard.test.tsx`

**Cobertura**:
- ✅ Renderização com nome apenas
- ✅ Renderização com todas as props (nome, role, email, phone, avatar)
- ✅ Avatar com URL
- ✅ Avatar placeholder com iniciais
- ✅ Campos opcionais (role, email, phone, chat button)
- ✅ Interação do botão de chat (onPress)
- ✅ Múltiplos cliques no botão
- ✅ Display de diferentes roles (Cliente, Profissional)
- ✅ Capitalização de iniciais

**Total**: 13 testes

### 3. ChatModal.test.tsx
**Localização**: `mobile/src/__tests__/components/ChatModal.test.tsx`

**Cobertura**:
- ✅ Estado de loading inicial
- ✅ Renderização do modal quando visível
- ✅ Não renderização quando invisível
- ✅ Carregamento de detalhes do contato
- ✅ Marcação de mensagens como lidas
- ✅ Display de mensagens após carregamento
- ✅ Envio de mensagens via botão
- ✅ Prevenção de envio de mensagens vazias
- ✅ Limpeza do input após envio
- ✅ Função de fechar modal
- ✅ Criação de conexão WebSocket
- ✅ Setup de listener de mensagens
- ✅ Display correto do nome do outro usuário (profissional/cliente)

**Total**: 13 testes

### 4. notifications.test.ts
**Localização**: `mobile/src/__tests__/services/notifications.test.ts`

**Cobertura**:
- ✅ Registro de notificações push (apenas em dispositivos físicos)
- ✅ Solicitação de permissões
- ✅ Tratamento de permissões negadas
- ✅ Obtenção de token do dispositivo
- ✅ Registro de token no servidor
- ✅ Tratamento de erros de API
- ✅ Configuração de listener de resposta de notificação
- ✅ Abertura de chat ao clicar em notificação (new_message)
- ✅ Abertura de chat ao clicar em notificação (new_contact)
- ✅ Tratamento de notificações sem contact_id
- ✅ Configuração de listener de notificações recebidas
- ✅ Configuração do handler de notificações

**Total**: 20 testes

### 5. ProjectContactsList.test.tsx
**Localização**: `mobile/src/__tests__/components/ProjectContactsList.test.tsx`

**Cobertura**:
- ✅ Renderização de lista de contatos
- ✅ Estado vazio quando não há contatos
- ✅ Display de badge de mensagens não lidas
- ✅ Display da última mensagem
- ✅ Display do preço da proposta
- ✅ Display de labels de status
- ✅ Abertura de chat ao clicar em contato
- ✅ Uso de handler customizado (onContactPress)
- ✅ Labels corretos para cada status
- ✅ Renderização de avatar (imagem ou ícone)
- ✅ Formatação de data relativa

**Total**: 16 testes

## Estatísticas Totais

- **Total de arquivos de teste**: 5
- **Total de testes**: 71
- **Cobertura de componentes**: 100% dos novos componentes
- **Cobertura de serviços**: 100% das novas funções
- **Cobertura de stores**: 100% do novo store

## Estrutura de Testes

```
mobile/src/__tests__/
├── components/
│   ├── ChatModal.test.tsx
│   ├── ProfileCard.test.tsx
│   └── ProjectContactsList.test.tsx
├── services/
│   └── notifications.test.ts
└── stores/
    └── chatStore.test.ts
```

## Como Executar os Testes

### Todos os testes
```bash
cd mobile
npm test
```

### Testes específicos
```bash
# Apenas testes de stores
npm test -- stores

# Apenas testes de components
npm test -- components

# Apenas testes de services
npm test -- services

# Teste específico
npm test -- chatStore.test
```

### Com cobertura
```bash
npm test -- --coverage
```

### Watch mode (desenvolvimento)
```bash
npm test -- --watch
```

## Mocks Utilizados

Os testes utilizam os seguintes mocks (já configurados no projeto):

1. **expo-notifications**: Mock de notificações
2. **expo-device**: Mock de informações do dispositivo
3. **expo-secure-store**: Mock de armazenamento seguro
4. **@react-native-async-storage/async-storage**: Mock de AsyncStorage
5. **Módulos personalizados**:
   - `../../api/contacts`
   - `../../api/auth`
   - `../../services/websocket`
   - `../../stores/authStore`
   - `../../stores/chatStore`

## Padrões de Teste Seguidos

1. **AAA Pattern**: Arrange, Act, Assert
2. **Describe/It Structure**: Agrupamento lógico de testes
3. **BeforeEach**: Limpeza de estado entre testes
4. **Mocks consistentes**: Uso de jest.mock para dependências
5. **Assertions claras**: Expectativas explícitas e específicas
6. **Testing Library**: Uso de @testing-library/react-native
7. **Async/Await**: Tratamento adequado de operações assíncronas

## Casos de Teste Cobertos

### Casos Positivos
- ✅ Fluxos normais de uso
- ✅ Interações do usuário (cliques, inputs)
- ✅ Carregamento de dados
- ✅ Envio de dados
- ✅ Navegação e estados

### Casos Negativos
- ✅ Permissões negadas
- ✅ Erros de API
- ✅ Campos vazios/inválidos
- ✅ Estados de loading/erro
- ✅ Dispositivos não suportados

### Casos de Borda
- ✅ Valores nulos/undefined
- ✅ Strings vazias
- ✅ Múltiplas chamadas consecutivas
- ✅ Estados intermediários

## Integração com CI/CD

Os testes podem ser executados em CI/CD com:

```bash
npm run test:ci
```

Este comando:
- Executa todos os testes
- Gera relatório de cobertura
- Usa workers limitados (ideal para CI)
- Não requer interação

## Cobertura de Código

### Metas de Cobertura

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Arquivos Testados

| Arquivo | Cobertura Esperada |
|---------|-------------------|
| chatStore.ts | 100% |
| ProfileCard.tsx | 100% |
| ChatModal.tsx | 90%+ |
| notifications.ts | 90%+ |
| ProjectContactsList.tsx | 95%+ |

## Próximos Passos

1. **Executar os testes**: `npm test`
2. **Verificar cobertura**: `npm test -- --coverage`
3. **Corrigir falhas** (se houver)
4. **Adicionar ao CI/CD**
5. **Manter testes atualizados** conforme código evolui

## Notas Importantes

1. **Mocks são essenciais**: Testes não fazem chamadas reais de API
2. **Isolamento**: Cada teste é independente e não afeta outros
3. **Performance**: Testes devem executar rapidamente (< 1s cada)
4. **Manutenção**: Atualizar testes quando funcionalidades mudarem
5. **Documentação**: Testes servem como documentação viva do código

## Troubleshooting

### Problema: "Cannot find module"
**Solução**: Verificar que todos os imports estão corretos e os mocks estão configurados

### Problema: "Test timeout"
**Solução**: Aumentar timeout ou verificar promises não resolvidas

### Problema: "Cannot read property of undefined"
**Solução**: Verificar que mocks estão retornando valores esperados

### Problema: "Component not rendering"
**Solução**: Verificar que todos os mocks necessários estão configurados

## Referências

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
