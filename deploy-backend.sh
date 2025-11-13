#!/bin/bash
set -e

echo "🔄 Fazendo pull das mudanças..."
git pull

echo "🛑 Parando container do backend..."
docker-compose -f docker-compose.prod.yml stop backend

echo "🗑️  Removendo container do backend..."
docker-compose -f docker-compose.prod.yml rm -f backend

echo "🔨 Reconstruindo e subindo backend..."
docker-compose -f docker-compose.prod.yml up -d --build backend

echo "📋 Verificando logs do backend..."
docker-compose -f docker-compose.prod.yml logs --tail=20 backend

echo "✅ Deploy do backend concluído!"
