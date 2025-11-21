#!/bin/bash
set -e

echo "🔄 Fazendo pull das mudanças..."
git pull

echo "🛑 Parando container do backend..."
docker-compose stop backend

echo "🗑️  Removendo container do backend..."
docker-compose rm -f backend

echo "🔨 Reconstruindo e subindo backend..."
docker-compose up -d --build backend

echo "📋 Verificando logs do backend..."
docker-compose logs --tail=20 backend

echo "✅ Deploy do backend concluído!"
