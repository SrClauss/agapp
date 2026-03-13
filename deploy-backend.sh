#!/bin/bash
set -e

echo "🔄 Sincronizando com o branch remoto master..."
# Garantir que estamos no branch master e que estamos alinhados com o remoto
# (evita falha quando o branch de upstream configurado não existe mais).
git fetch --prune origin
# Força checkout em master (cria se não existir localmente)
git checkout -B master origin/master
# Sincroniza o histórico local com o remoto
git reset --hard origin/master

echo "🛑 Parando container do backend..."
docker-compose stop backend

echo "🗑️  Removendo container do backend..."
docker-compose rm -f backend

echo "🔨 Reconstruindo e subindo backend..."
docker-compose up -d --build backend

echo "📋 Verificando logs do backend..."
docker-compose logs --tail=20 backend

echo "✅ Deploy do backend concluído!"
