#!/bin/bash
set -e

echo "[entrypoint] Aguardando MongoDB estar disponível..."

# Loop até MongoDB responder
MAX_TRIES=30
TRIES=0

until python3 -c "from pymongo import MongoClient; import os; MongoClient(os.getenv('MONGODB_URL')).admin.command('ping')" 2>/dev/null; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -ge $MAX_TRIES ]; then
    echo "[entrypoint] ERRO: MongoDB não ficou disponível após $MAX_TRIES tentativas"
    exit 1
  fi
  echo "[entrypoint] MongoDB não disponível ainda, tentativa $TRIES/$MAX_TRIES..."
  sleep 2
done

echo "[entrypoint] MongoDB disponível!"

# Criar admin se não existir
echo "[entrypoint] Garantindo existência do admin..."
python3 /app/scripts/ensure_admin.py
if [ $? -ne 0 ]; then
  echo "[entrypoint] ERRO ao criar admin, abortando"
  exit 1
fi

echo "[entrypoint] Inicialização concluída, iniciando aplicação..."
exec "$@"
