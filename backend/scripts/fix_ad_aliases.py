"""
Script para renomear os aliases dos ads para os nomes corretos das locations
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
import shutil

async def fix_aliases():
    # Conectar ao MongoDB
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.professional_platform

    # Mapeamento de aliases antigos para novos
    alias_map = {
        "publi_client": "publi_screen_client",
        "publi_professional": "publi_screen_professional",
        "banner_client": "banner_client_home",
        "banner_professional": "banner_professional_home"
    }

    ads_dir = Path("./ads")

    for old_alias, new_alias in alias_map.items():
        # Atualizar no banco
        result = await db.ad_contents.update_one(
            {"alias": old_alias},
            {"$set": {"alias": new_alias}}
        )

        if result.modified_count > 0:
            print(f"✅ Alias atualizado no banco: {old_alias} → {new_alias}")

            # Renomear diretório
            old_dir = ads_dir / old_alias
            new_dir = ads_dir / new_alias

            if old_dir.exists():
                if new_dir.exists():
                    shutil.rmtree(new_dir)
                old_dir.rename(new_dir)
                print(f"✅ Diretório renomeado: {old_alias}/ → {new_alias}/")

                # Atualizar paths dos arquivos no banco
                await db.ad_contents.update_one(
                    {"alias": new_alias},
                    {
                        "$set": {
                            "index_html": f"{new_alias}/index.html",
                            "css_files": [f"{new_alias}/style.css"] if old_dir.exists() else [],
                            "js_files": [f"{new_alias}/script.js"] if old_dir.exists() else [],
                            "image_files": []  # Atualizar conforme necessário
                        }
                    }
                )
                print(f"✅ Paths atualizados para: {new_alias}")
        else:
            print(f"ℹ️  Alias não encontrado: {old_alias}")

    print("\n🎉 Migração concluída!")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_aliases())
