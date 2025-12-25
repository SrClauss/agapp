"""
Firebase Cloud Messaging (FCM) - Push Notifications
"""
import firebase_admin
from firebase_admin import credentials, messaging
from typing import Optional, List, Dict, Any
import os
from pathlib import Path

# Inicializar Firebase Admin SDK (singleton)
_firebase_app = None

def initialize_firebase():
    """Inicializa Firebase Admin SDK se ainda não foi inicializado"""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        from app.core.config import settings

        # Opção 1: Usar variáveis de ambiente (RECOMENDADO)
        if settings.firebase_project_id and settings.firebase_private_key:
            print("Initializing Firebase from environment variables...")

            # Construir objeto de credenciais a partir das variáveis
            cred_dict = {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "private_key_id": settings.firebase_private_key_id,
                "private_key": settings.firebase_private_key.replace("\\n", "\n"),  # Corrigir quebras de linha
                "client_email": settings.firebase_client_email,
                "client_id": settings.firebase_client_id,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": settings.firebase_client_x509_cert_url,
                "universe_domain": "googleapis.com"
            }

            cred = credentials.Certificate(cred_dict)
            _firebase_app = firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized from environment variables")
            return _firebase_app

        # Opção 2: Fallback para arquivo JSON (para desenvolvimento local)
        creds_path = Path(__file__).parent.parent.parent / "agilizzapp-206f1-firebase-adminsdk-fbsvc-6b55054773.json"

        if creds_path.exists():
            print("Initializing Firebase from JSON file (fallback)...")
            cred = credentials.Certificate(str(creds_path))
            _firebase_app = firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin SDK initialized from JSON file")
            return _firebase_app

        # Nenhuma opção disponível
        print("⚠️ Warning: Firebase credentials not configured (neither env vars nor JSON file)")
        print("   Push notifications will NOT work until you configure Firebase credentials")
        return None

    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        return None


def create_or_update_firebase_user(email: str, password: str, display_name: Optional[str] = None) -> str:
    """Cria ou atualiza um usuário no Firebase Auth.

    Retorna o UID do usuário criado/atualizado.
    """
    if _firebase_app is None:
        initialize_firebase()

    if _firebase_app is None:
        raise Exception("Firebase not initialized")

    try:
        from firebase_admin import auth
        # Tenta buscar usuário existente
        try:
            fb_user = auth.get_user_by_email(email)
            # Atualiza senha (e display name se fornecido)
            update_kwargs = {"password": password}
            if display_name:
                update_kwargs["display_name"] = display_name
            auth.update_user(fb_user.uid, **update_kwargs)
            return fb_user.uid
        except Exception:
            # Se não existe, cria novo usuário
            fb_user = auth.create_user(email=email, password=password, display_name=display_name)
            return fb_user.uid
    except Exception as e:
        # Não expor detalhes sensíveis
        raise Exception(f"Firebase user create/update failed: {str(e)}")


async def send_push_notification(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    image_url: Optional[str] = None
) -> bool:
    """
    Envia notificação push para um único dispositivo via FCM

    Args:
        fcm_token: Token FCM do dispositivo
        title: Título da notificação
        body: Corpo da notificação
        data: Dados adicionais (payload JSON)
        image_url: URL de imagem (opcional)

    Returns:
        bool: True se enviado com sucesso
    """
    if _firebase_app is None:
        initialize_firebase()

    if _firebase_app is None:
        print("Firebase not initialized, skipping push notification")
        return False

    try:
        # Converter data values para strings (FCM exige)
        string_data = {}
        if data:
            for key, value in data.items():
                string_data[key] = str(value)

        # Construir mensagem
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url if image_url else None
            ),
            data=string_data,
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    channel_id='messages',  # Canal de notificações
                    priority='high',
                    default_vibrate_timings=True
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1,
                        alert=messaging.ApsAlert(
                            title=title,
                            body=body
                        )
                    )
                )
            )
        )

        # Enviar
        response = messaging.send(message)
        print(f"✅ FCM sent successfully: {response}")
        return True

    except messaging.UnregisteredError:
        print(f"❌ FCM token is invalid or unregistered: {fcm_token[:20]}...")
        return False
    except Exception as e:
        print(f"❌ Error sending FCM: {e}")
        return False


async def send_multicast_notification(
    fcm_tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    image_url: Optional[str] = None
) -> Dict[str, int]:
    """
    Envia notificação push para múltiplos dispositivos

    Args:
        fcm_tokens: Lista de tokens FCM
        title: Título da notificação
        body: Corpo da notificação
        data: Dados adicionais
        image_url: URL de imagem

    Returns:
        dict: {"success_count": int, "failure_count": int, "invalid_tokens": [str]}
    """
    if _firebase_app is None:
        initialize_firebase()

    if _firebase_app is None:
        print("Firebase not initialized, skipping multicast push")
        return {"success_count": 0, "failure_count": len(fcm_tokens), "invalid_tokens": []}

    if not fcm_tokens:
        return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}

    try:
        # Converter data values para strings
        string_data = {}
        if data:
            for key, value in data.items():
                string_data[key] = str(value)

        # Construir mensagem multicast
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url if image_url else None
            ),
            data=string_data,
            tokens=fcm_tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    channel_id='messages',
                    priority='high'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1
                    )
                )
            )
        )

        # Enviar
        response = messaging.send_multicast(message)

        # Identificar tokens inválidos
        invalid_tokens = []
        if response.failure_count > 0:
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    if isinstance(resp.exception, messaging.UnregisteredError):
                        invalid_tokens.append(fcm_tokens[idx])

        print(f"📤 Multicast sent: {response.success_count} success, {response.failure_count} failed")

        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
            "invalid_tokens": invalid_tokens
        }

    except Exception as e:
        print(f"❌ Error sending multicast FCM: {e}")
        return {
            "success_count": 0,
            "failure_count": len(fcm_tokens),
            "invalid_tokens": []
        }


async def send_topic_notification(
    topic: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None
) -> bool:
    """
    Envia notificação para um tópico (grupo de usuários)

    Args:
        topic: Nome do tópico
        title: Título
        body: Corpo
        data: Dados adicionais

    Returns:
        bool: True se enviado com sucesso
    """
    if _firebase_app is None:
        initialize_firebase()

    if _firebase_app is None:
        return False

    try:
        string_data = {}
        if data:
            for key, value in data.items():
                string_data[key] = str(value)

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=string_data,
            topic=topic,
            android=messaging.AndroidConfig(priority='high')
        )

        response = messaging.send(message)
        print(f"✅ Topic notification sent to '{topic}': {response}")
        return True

    except Exception as e:
        print(f"❌ Error sending topic notification: {e}")
        return False


# Inicializar ao importar o módulo
initialize_firebase()
