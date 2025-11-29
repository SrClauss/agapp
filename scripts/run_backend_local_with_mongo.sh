#!/usr/bin/env bash
set -euo pipefail

# Script para iniciar Mongo no docker com porta mapeada e iniciar o backend local
# Uso: bash scripts/run_backend_local_with_mongo.sh

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

COMPOSE_FILE=docker-compose.dev.yml
# Se docker-compose.dev.yml não existir, tenta docker-compose.yml
if [ ! -f "$COMPOSE_FILE" ]; then
  if [ -f docker-compose.yml ]; then
    COMPOSE_FILE=docker-compose.yml
  else
    echo "Arquivo docker-compose.dev.yml nem docker-compose.yml encontrado. Saindo..."
    exit 1
  fi
fi

# Subir mongodb (vai criar ou usar o container configurado no compose)
echo "Subindo MongoDB via $COMPOSE_FILE..."
docker compose -f "$COMPOSE_FILE" up -d mongodb

# Esperar Mongo estar disponível (porta 27017)
echo "Aguardando MongoDB ficar pronto em localhost:27017..."
MAX_TRIES=30
TRY=0
MONGO_CONTAINER=""
while [ $TRY -lt $MAX_TRIES ]; do
  # Prefere checar via nc no host
  if command -v nc >/dev/null 2>&1; then
    if nc -z localhost 27017; then
      echo "Mongo pronto (nc)."
      break
    fi
  fi

  # tenta identificar nome do container Mongo (agiliza_mongodb ou agiliza_mongodb_dev)
  if [ -z "$MONGO_CONTAINER" ]; then
    MONGO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'agiliza_mongodb(_dev)?' | head -n1 || true)
    if [ -z "$MONGO_CONTAINER" ]; then
      # fallback: procura container que tenha imagem mongo
      MONGO_CONTAINER=$(docker ps --filter ancestor=mongo --format '{{.Names}}' | head -n1 || true)
    fi
  fi

  if [ -n "$MONGO_CONTAINER" ]; then
    if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'db.adminCommand("ping")' >/dev/null 2>&1; then
      echo "Mongo pronto (mongosh inside container: $MONGO_CONTAINER)."
      break
    fi
  fi

  TRY=$((TRY+1))
  sleep 1
done

if [ $TRY -ge $MAX_TRIES ]; then
  echo "MongoDB não ficou pronto após $MAX_TRIES tentativas. Saindo..."
  docker compose -f "$COMPOSE_FILE" ps mongodb || true
  exit 1
fi

# Ler credenciais do docker-compose (evita usar `source .env` que pode executar conteúdo)
MONGO_USER="root"
MONGO_PASS="AGar1401al2312"
if [ -n "$MONGO_CONTAINER" ]; then
  # tenta obter do inspect do container (procura chaves MONGO_INITDB_ROOT_USERNAME/ MONGO_INITDB_ROOT_PASSWORD)
  MONGO_USER_INSPECT=$(docker inspect "$MONGO_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MONGO_INITDB_ROOT_USERNAME=//p' | head -n1 || true)
  MONGO_PASS_INSPECT=$(docker inspect "$MONGO_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MONGO_INITDB_ROOT_PASSWORD=//p' | head -n1 || true)
  if [ -n "$MONGO_USER_INSPECT" ]; then
    MONGO_USER="$MONGO_USER_INSPECT"
  fi
  if [ -n "$MONGO_PASS_INSPECT" ]; then
    MONGO_PASS="$MONGO_PASS_INSPECT"
  fi
fi
DATABASE_NAME="${DATABASE_NAME:-agiliza}"
MONGODB_URL_LOCAL="mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:27017/${DATABASE_NAME}?authSource=admin"

export MONGODB_URL="${MONGODB_URL_LOCAL}"

# Parar uvicorn local se existir
if pgrep -f "uvicorn app.main:app" >/dev/null 2>&1; then
  echo "Matando uvicorn local existente"
  pkill -f "uvicorn app.main:app" || true
  sleep 1
fi

# Inicia uvicorn no backend
cd backend
if [ -f "venv/bin/activate" ]; then
  echo "Ativando venv local..."
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

echo "Iniciando uvicorn (aplicação local apontando para Mongo em localhost)..."
uvicorn app.main:app --reload
