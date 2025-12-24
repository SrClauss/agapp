# AgilizaPro Desktop - Tauri

Este diretório contém a configuração do Tauri para construir a versão desktop do AgilizaPro.

## Pré-requisitos

### Sistema Operacional

- **Windows**: Windows 10+
- **macOS**: macOS 10.15+
- **Linux**: Ubuntu 22.04+ ou outra distribuição moderna

### Ferramentas Necessárias

1. **Node.js** v20+ e npm
2. **Rust** (instale via [rustup](https://rustup.rs/))
3. **Dependências do Sistema** (apenas Linux):
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libwebkit2gtk-4.1-dev \
     libappindicator3-dev \
     librsvg2-dev \
     patchelf \
     libssl-dev
   ```

## Desenvolvimento

### Primeira Configuração

1. Instale as dependências do projeto:
   ```bash
   cd mobile
   npm install
   ```

2. Para rodar o app em modo de desenvolvimento:
   ```bash
   npm run tauri:dev
   ```

   Isso irá:
   - Iniciar o servidor de desenvolvimento web do Expo
   - Abrir a aplicação Tauri com hot-reload

## Build de Produção

### Build Local

Para construir o executável localmente:

```bash
cd mobile
npm run tauri:build
```

O executável será gerado em:
- **Windows**: `mobile/src-tauri/target/release/agilizapro.exe`
- **macOS**: `mobile/src-tauri/target/release/bundle/dmg/AgilizaPro_*.dmg`
- **Linux**: `mobile/src-tauri/target/release/bundle/appimage/agilizapro_*.AppImage`

### Build via GitHub Actions

O workflow `.github/workflows/tauri-build.yml` automatiza o build para todas as plataformas:

1. **Push para master/main**: Cria builds automáticos
2. **Tags de versão** (ex: `v1.0.0`): Cria um release draft no GitHub com os executáveis
3. **Pull Requests**: Valida que o build funciona

Os artefatos de build estarão disponíveis:
- Na seção "Artifacts" do workflow run (builds de push/PR)
- Como assets no GitHub Release (para tags de versão)

## Estrutura do Projeto

```
mobile/
├── src-tauri/          # Código Rust do Tauri
│   ├── src/           # Código fonte Rust
│   ├── icons/         # Ícones da aplicação
│   ├── Cargo.toml     # Configuração do Rust
│   └── tauri.conf.json # Configuração do Tauri
├── dist/              # Build web do Expo (gerado)
├── src/               # Código fonte React Native
└── package.json       # Dependências Node.js
```

## Configuração

### Alterando Identificador da App

Edite `mobile/src-tauri/tauri.conf.json`:

```json
{
  "identifier": "com.agilizapro.agapp"
}
```

### Alterando Ícones

Substitua os ícones em `mobile/src-tauri/icons/` pelos seus próprios ícones.

### Permissões e Capabilities

As permissões da aplicação são definidas em `mobile/src-tauri/capabilities/default.json`.

## Solução de Problemas

### Erro: "webkit2gtk not found" (Linux)

Instale as dependências do sistema listadas na seção "Pré-requisitos".

### Erro durante o build do Expo

Certifique-se de que todas as dependências web estão instaladas:
```bash
npm install react-dom react-native-web
```

### Build falha no CI

Verifique os logs do GitHub Actions para mensagens de erro específicas. Os erros comuns incluem:
- Dependências faltando
- Problemas de permissão
- Limites de tempo esgotados

## Mais Informações

- [Documentação do Tauri](https://tauri.app/v2/guides/)
- [Documentação do Expo](https://docs.expo.dev/)
- [Guia de Build do Tauri](https://tauri.app/v2/guides/building/)
