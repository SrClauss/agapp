#!/usr/bin/env python3
"""
Script para resetar completamente o banco de dados e manter apenas o admin.

Uso:
    cd /home/claus/src/agilizapp/backend
    ./venv/bin/python scripts/reset_and_admin.py

Este script:
1. Remove TODAS as collections e dados do banco
2. Recria os índices básicos
3. Cria apenas o usuário admin (admin@agilizapp.com / admin123)

ATENÇÃO: Todos os dados serão perdidos permanentemente!
"""
import os
import sys
from pymongo import MongoClient
import bcrypt
from datetime import datetime

# Configurações do banco
MONGO_URL = os.getenv('MONGODB_URL', 'mongodb://admin:AG%40ar1401al2312@127.0.0.1:27017/agiliza_database?authSource=admin')
DB_NAME = os.getenv('DATABASE_NAME', 'agiliza_database')

def reset_database():
    """Reseta completamente o banco de dados"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]

        print(f"[reset_db] Conectando ao MongoDB: {MONGO_URL}")
        client.admin.command('ping')
        print("[reset_db] Conexão estabelecida!")

        # Listar todas as collections antes de dropar
        collections = db.list_collection_names()
        print(f"[reset_db] Collections encontradas: {collections}")

        # Dropar o banco completamente
        print(f"[reset_db] Dropando banco de dados: {DB_NAME}")
        client.drop_database(DB_NAME)
        print("[reset_db] Banco dropado com sucesso!")

        # Recriar o banco e collections básicas
        db = client[DB_NAME]

        # Criar índices básicos
        users = db.users
        users.create_index('email', unique=True)
        users.create_index([('coordinates', '2dsphere')])

        print("[reset_db] Índices criados!")

        return True

    except Exception as e:
        print(f"[reset_db] ERRO ao resetar banco: {e}")
        return False

def ensure_admin():
    """Garante que existe o admin no banco"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]

        # Verificar se já existe algum admin
        admin_count = db.users.count_documents({'roles': {'$in': ['admin']}})

        if admin_count > 0:
            print(f'[ensure_admin] Admin já existe ({admin_count} admin(s) encontrado(s))')
            return True

        # Criar admin
        print('[ensure_admin] Criando admin padrão...')
        hashed_password = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()

        admin_doc = {
            '_id': 'admin_user_001',  # ID fixo para consistência
            'email': 'admin@agilizapp.com',
            'hashed_password': hashed_password,
            'full_name': 'Administrador',
            'cpf': '00000000000',
            'phone': None,
            'roles': ['admin'],
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'address': None,
            'coordinates': None,
            'professional_info': None,
            'subscription': None
        }

        db.users.insert_one(admin_doc)
        print('[ensure_admin] Admin criado com sucesso!')
        print('  Email: admin@agilizapp.com')
        print('  Senha: admin123')
        return True

    except Exception as e:
        print(f'[ensure_admin] ERRO ao criar admin: {e}')
        return False

def main():
    print("=" * 50)
    print("RESETANDO BANCO DE DADOS - MANTENDO APENAS ADMIN")
    print("=" * 50)

    # Resetar banco
    if not reset_database():
        print("[MAIN] Falha ao resetar banco!")
        return 1

    # Garantir admin
    if not ensure_admin():
        print("[MAIN] Falha ao criar admin!")
        return 1

    print("=" * 50)
    print("✅ RESET CONCLUÍDO COM SUCESSO!")
    print("Banco limpo e admin criado.")
    print("=" * 50)
    return 0

if __name__ == '__main__':
    sys.exit(main())