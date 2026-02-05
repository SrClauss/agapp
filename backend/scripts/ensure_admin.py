#!/usr/bin/env python3
"""
Script para garantir que existe pelo menos um admin no banco.
Se não existir nenhum admin, cria admin@agilizapp.com / admin123.
Executado durante o startup do container backend (entrypoint.sh).
"""
import os
import sys
from datetime import datetime
from pymongo import MongoClient
import bcrypt

# Use environment variables instead of hardcoded credentials
MONGO_URL = os.getenv('MONGODB_URL', 'mongodb://localhost:27017/agiliza?authSource=admin')
DB_NAME = os.getenv('DATABASE_NAME', 'agiliza')

# Admin configuration (can be set via env)
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@agilizapp.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
ADMIN_FULL_NAME = os.getenv('ADMIN_FULL_NAME', 'Administrador')
ADMIN_ROLES = os.getenv('ADMIN_ROLES', 'admin').split(',')
ADMIN_CPF = os.getenv('ADMIN_CPF', '00000000000')
ADMIN_PHONE = os.getenv('ADMIN_PHONE')

def main():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Verificar se já existe algum admin
        admin_count = db.users.count_documents({'roles': {'$in': ['admin']}})
        
        if admin_count > 0:
            print(f'[ensure_admin] Admin já existe ({admin_count} admin(s) encontrado(s))')
            return 0
        
        # Criar admin com dados vindos da env
        print(f"[ensure_admin] Nenhum admin encontrado, criando admin padrão ({ADMIN_EMAIL})...")
        hashed_password = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        
        admin_doc = {
            'email': ADMIN_EMAIL,
            'hashed_password': hashed_password,
            'full_name': ADMIN_FULL_NAME,
            'cpf': ADMIN_CPF,
            'phone': ADMIN_PHONE,
            'roles': ADMIN_ROLES,
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'address': None,
            'coordinates': None,
            'professional_info': None,
            'subscription': None
        }
        
        db.users.insert_one(admin_doc)
        print(f"[ensure_admin] Admin criado com sucesso: {ADMIN_EMAIL} (senha definida via env)")
        return 0
        
    except Exception as e:
        print(f'[ensure_admin] ERRO ao criar admin: {e}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
