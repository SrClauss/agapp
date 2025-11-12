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

MONGO_URL = os.getenv('MONGODB_URL', 'mongodb://admin:AG%40ar1401al2312@mongodb:27017/agiliza_database?authSource=admin')
DB_NAME = os.getenv('DATABASE_NAME', 'agiliza_database')

def main():
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Verificar se já existe algum admin
        admin_count = db.users.count_documents({'roles': {'$in': ['admin']}})
        
        if admin_count > 0:
            print(f'[ensure_admin] Admin já existe ({admin_count} admin(s) encontrado(s))')
            return 0
        
        # Criar admin
        print('[ensure_admin] Nenhum admin encontrado, criando admin padrão...')
        hashed_password = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()
        
        admin_doc = {
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
        print('[ensure_admin] Admin criado com sucesso: admin@agilizapp.com (senha: admin123)')
        return 0
        
    except Exception as e:
        print(f'[ensure_admin] ERRO ao criar admin: {e}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
