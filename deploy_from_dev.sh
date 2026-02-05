#!/bin/bash

# Configurações
SERVER="72.61.48.59"
USER="root" # Substitua pelo seu usuário SSH
REMOTE_DIR="/srv/agapp"
DEPLOY_SCRIPT="deploy_backend"

# Mensagem de commit
COMMIT_MESSAGE="Deploy automático via script"

# Etapa 1: Fazer commit de todas as alterações
echo "Fazendo commit de todas as alterações..."
git add .
git commit -m "$COMMIT_MESSAGE"

# Etapa 2: Acessar o servidor remoto e executar o script de deploy
echo "Conectando ao servidor $SERVER e executando o script de deploy..."
ssh -tt "$USER@$SERVER" << EOF
  set -e
  echo "Entrando no diretório $REMOTE_DIR..."
  cd $REMOTE_DIR
  echo "Executando o script $DEPLOY_SCRIPT..."
  bash $DEPLOY_SCRIPT
  echo "Status do processo de deploy:"
  echo "-----------------------------"
  tail -n 20 deploy.log
EOF

echo "Deploy concluído com sucesso!"