#!/bin/bash

# Configurações
SERVER="72.61.48.59"
USER="root" # Substitua pelo seu usuário SSH
REMOTE_DIR="/srv/agapp"
DEPLOY_SCRIPT="deploy-backend.sh"

# Mensagem de commit (padrão)
COMMIT_MESSAGE="Deploy automático via script"

# Suporte a mensagem de commit passada como parâmetro.
# Uso: ./deploy_from_dev.sh "Minha mensagem de commit"
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: $0 [commit message]"
  echo "If no commit message is provided, defaults to: '$COMMIT_MESSAGE'"
  exit 0
fi

# Se houver argumentos, use todos como mensagem de commit (permite múltiplas palavras)
if [ "$#" -gt 0 ]; then
  COMMIT_MESSAGE="$*"
fi

# Etapa 1: Fazer commit de todas as alterações
echo "Fazendo commit de todas as alterações..."
git add .
git commit -m "$COMMIT_MESSAGE"

# Adicionando o comando para fazer o push após o commit
echo "Fazendo push das alterações..."
git push

# Etapa 2: Acessar o servidor remoto e executar o script de deploy
echo "Conectando ao servidor $SERVER e executando o script de deploy..."
ssh -tt "$USER@$SERVER" << EOF
  set -e
  echo "Entrando no diretório $REMOTE_DIR..."
  cd $REMOTE_DIR
  echo "Executando o script $DEPLOY_SCRIPT (saída será gravada em deploy.log)..."
  # Adiciona um cabeçalho com timestamp e grava toda a saída (stdout+stderr) em deploy.log
  echo "=== Deploy started: $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> deploy.log
  bash $DEPLOY_SCRIPT 2>&1 | tee -a deploy.log
  echo "=== Deploy finished: $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> deploy.log

  echo "Status do processo de deploy (últimas 100 linhas):"
  echo "-----------------------------"
  tail -n 100 deploy.log
EOF

echo "Deploy concluído com sucesso!"