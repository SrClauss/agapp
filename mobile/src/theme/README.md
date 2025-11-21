# Sistema de Tema Centralizado

Este projeto agora utiliza um sistema de tema centralizado para manter consistência visual em todas as telas.

## Estrutura

```
src/theme/
├── colors.ts      # Definições de cores
├── fonts.ts       # Definições de fontes e tamanhos
├── styles.ts      # Estilos comuns reutilizáveis
└── index.ts       # Tema principal do React Native Paper
```

## Como usar

### Importar estilos comuns

```tsx
import { commonStyles } from '../theme/styles';
```

### Usar estilos comuns

```tsx
<View style={commonStyles.container}>
  <Surface style={commonStyles.surface}>
    <Title style={commonStyles.title}>Título</Title>
    <TextInput style={commonStyles.input} />
    <Button style={commonStyles.button}>Ação</Button>
  </Surface>
</View>
```

### Cores disponíveis

```tsx
import { colors } from '../theme/colors';

// Uso direto
<Text style={{ color: colors.primary }}>Texto</Text>
```

### Fontes disponíveis

```tsx
import { fonts } from '../theme/fonts';

// Tamanhos
<Text style={{ fontSize: fonts.size.lg }}>Texto grande</Text>

// Pesos
<Text style={{ fontWeight: fonts.weight.bold }}>Texto em negrito</Text>
```

## Vantagens

- **Consistência**: Todas as telas usam os mesmos estilos
- **Manutenibilidade**: Mudanças no tema afetam todo o app
- **Reutilização**: Estilos comuns evitam duplicação de código
- **Escalabilidade**: Fácil adicionar novos estilos ou modificar existentes

## Adicionando novos estilos

Para adicionar novos estilos comuns, edite o arquivo `src/theme/styles.ts`:

```tsx
export const commonStyles = StyleSheet.create({
  // ... estilos existentes

  // Novo estilo
  customStyle: {
    // ... propriedades
  },
});
```