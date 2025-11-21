#!/usr/bin/env python3
"""
Script helper para extrair credenciais do Firebase JSON e formatar para .env

Uso:
    python scripts/extract-firebase-creds.py path/to/firebase-adminsdk.json

Output: variáveis prontas para copiar e colar no .env
"""

import json
import sys
from pathlib import Path

def extract_firebase_credentials(json_path: str):
    """Lê o JSON do Firebase e imprime variáveis para .env"""

    try:
        with open(json_path, 'r') as f:
            data = json.load(f)

        print("\n" + "="*80)
        print("🔥 FIREBASE CREDENTIALS - Copy and paste into your .env file")
        print("="*80 + "\n")

        print("# Firebase Cloud Messaging (Push Notifications)")
        print(f'FIREBASE_PROJECT_ID={data["project_id"]}')
        print(f'FIREBASE_PRIVATE_KEY_ID={data["private_key_id"]}')
        print(f'FIREBASE_PRIVATE_KEY="{data["private_key"]}"')
        print(f'FIREBASE_CLIENT_EMAIL={data["client_email"]}')
        print(f'FIREBASE_CLIENT_ID={data["client_id"]}')
        print(f'FIREBASE_CLIENT_X509_CERT_URL={data["client_x509_cert_url"]}')

        print("\n" + "="*80)
        print("✅ Done! Copy the lines above to your .env file")
        print("⚠️  Remember: NEVER commit the .env file!")
        print("="*80 + "\n")

    except FileNotFoundError:
        print(f"❌ Error: File not found: {json_path}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Error: Invalid JSON file: {json_path}")
        sys.exit(1)
    except KeyError as e:
        print(f"❌ Error: Missing key in JSON: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python extract-firebase-creds.py <path-to-firebase-json>")
        print("\nExample:")
        print("  python scripts/extract-firebase-creds.py agilizzapp-206f1-firebase-adminsdk.json")
        sys.exit(1)

    json_path = sys.argv[1]
    extract_firebase_credentials(json_path)
