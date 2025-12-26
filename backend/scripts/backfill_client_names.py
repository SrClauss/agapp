#!/usr/bin/env python3
"""Script para retrofill (popular) client_name em projetos existentes.

Usage:
  python backend/scripts/backfill_client_names.py [--dry-run]
"""
import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
import argparse

load_dotenv()

MONGODB_URL = os.environ.get("MONGODB_URL") or os.environ.get("mongodb_url")
DATABASE_NAME = os.environ.get("DATABASE_NAME") or os.environ.get("database_name")

if not MONGODB_URL or not DATABASE_NAME:
    print("Erro: MONGODB_URL e DATABASE_NAME precisam estar definidas", file=sys.stderr)
    sys.exit(2)

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria feito sem fazer alterações")
args = parser.parse_args()

client = MongoClient(MONGODB_URL)
db = client[DATABASE_NAME]

# Buscar projetos sem client_name ou com client_name=None
query = {"$or": [{"client_name": {"$exists": False}}, {"client_name": None}]}
projects = list(db.projects.find(query))

print(f"Encontrados {len(projects)} projetos sem client_name")

updated = 0
not_found = 0

for proj in projects:
    client_id = proj.get("client_id")
    if not client_id:
        print(f"- Projeto {proj['_id']}: sem client_id, pulando")
        continue
    
    # Buscar usuário
    user = db.users.find_one({"_id": client_id}, {"full_name": 1})
    if not user:
        print(f"- Projeto {proj['_id']}: usuário {client_id} não encontrado")
        not_found += 1
        continue
    
    full_name = user.get("full_name")
    if not full_name:
        print(f"- Projeto {proj['_id']}: usuário {client_id} não tem full_name")
        not_found += 1
        continue
    
    if args.dry_run:
        print(f"- [DRY-RUN] Projeto {proj['_id']}: definiria client_name='{full_name}'")
    else:
        db.projects.update_one({"_id": proj["_id"]}, {"$set": {"client_name": full_name}})
        print(f"- Projeto {proj['_id']}: client_name definido como '{full_name}'")
    updated += 1

print(f"\nResumo:")
print(f"- Projetos atualizados: {updated}")
print(f"- Usuários não encontrados: {not_found}")
if args.dry_run:
    print("\n(Modo dry-run ativo - nenhuma alteração foi feita)")
