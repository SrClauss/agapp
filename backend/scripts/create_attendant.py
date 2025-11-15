#!/usr/bin/env python3
"""Cria um atendente diretamente no MongoDB.

Uso:
  python create_attendant.py --name "Fulano" --email fulano@example.com --password secret --role attendant

O script lê `MONGODB_URL` e `DATABASE_NAME` do ambiente, ou usa valores padrão para desenvolvimento.
"""
import os
import argparse
import bcrypt
from datetime import datetime
from ulid import ULID
from pymongo import MongoClient


def get_args():
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--role", default="attendant", choices=["attendant", "supervisor", "admin"])
    return p.parse_args()


def main():
    args = get_args()

    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "agiliza_database")

    client = MongoClient(mongo_url)
    db = client[db_name]

    existing = db.attendants.find_one({"email": args.email})
    if existing:
        print(f"Atendente com email {args.email} já existe (id={existing.get('_id')}). Saindo.")
        return

    password_hash = bcrypt.hashpw(args.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    attendant = {
        "_id": str(ULID()),
        "name": args.name,
        "email": args.email,
        "password_hash": password_hash,
        "phone": None,
        "role": args.role,
        "is_active": True,
        "photo_url": None,
        "tickets_attended": 0,
        "average_rating": 0.0,
        "is_online": False,
        "last_seen": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": None
    }

    res = db.attendants.insert_one(attendant)
    print(f"Atendente criado com _id={res.inserted_id} e email={args.email}")


if __name__ == "__main__":
    main()
