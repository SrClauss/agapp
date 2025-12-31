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
    checkout_url: str = "https://agilizapro.cloud/checkout"
    turnstile_secret_key: str
    turnstile_site_key: str
    cors_origins: List[str] = ["http://localhost:3000"]

    # Firebase Cloud Messaging (Backend)
    firebase_api_key: Optional[str] = None
    firebase_project_id: Optional[str] = None
    firebase_private_key_id: Optional[str] = None
    firebase_private_key: Optional[str] = None
    firebase_client_email: Optional[str] = None
    firebase_client_id: Optional[str] = None
    firebase_client_x509_cert_url: Optional[str] = None

    # Use pydantic v2 `model_config` to set env_file and ignore extra env vars
    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }

settings = Settings()