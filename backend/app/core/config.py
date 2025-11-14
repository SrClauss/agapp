from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    mongodb_url: str
    database_name: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    google_maps_api_key: str
    # Não usamos provedor de pagamento direto; remova qualquer chave relacionada se existir
    asaas_api_key: str
    asaas_environment: str = "sandbox"
    asaas_webhook_token: str = ""
    turnstile_secret_key: str
    turnstile_site_key: str
    cors_origins: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()