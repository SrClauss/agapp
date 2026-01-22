"""
Mock do Firebase Cloud Messaging para testes

Simula o envio de push notifications sem Firebase real.
Útil para testes de integração e e2e.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class MockFirebaseMessage:
    """Mock de firebase_admin.messaging.Message"""
    
    def __init__(self, notification=None, data=None, token=None, tokens=None, topic=None, condition=None, android=None, webpush=None, apns=None):
        self.notification = notification
        self.data = data
        self.token = token
        self.tokens = tokens
        self.topic = topic
        self.condition = condition
        self.android = android
        self.webpush = webpush
        self.apns = apns


class MockFirebaseNotification:
    """Mock de firebase_admin.messaging.Notification"""
    
    def __init__(self, title=None, body=None, image=None):
        self.title = title
        self.body = body
        self.image = image


class MockBatchResponse:
    """Mock de firebase_admin.messaging.BatchResponse"""
    
    def __init__(self, responses: List, success_count: int, failure_count: int):
        self.responses = responses
        self.success_count = success_count
        self.failure_count = failure_count


class MockSendResponse:
    """Mock de firebase_admin.messaging.SendResponse"""
    
    def __init__(self, message_id: Optional[str] = None, exception: Optional[Exception] = None):
        self.message_id = message_id
        self.exception = exception
        self.success = message_id is not None


class MockFirebaseMessaging:
    """
    Mock do Firebase Cloud Messaging
    
    Simula o comportamento do firebase_admin.messaging sem enviar notificações reais.
    Armazena histórico de notificações enviadas para validação nos testes.
    """
    
    def __init__(self):
        # Histórico de notificações enviadas
        self.sent_messages: List[Dict[str, Any]] = []
        self.sent_multicast: List[Dict[str, Any]] = []
        
        # Configurações de simulação
        self.should_fail = False  # Se True, simula falha de envio
        self.fail_tokens: List[str] = []  # Tokens que devem falhar
        
        # Contadores
        self._message_counter = 0
    
    def _generate_message_id(self) -> str:
        """Gera ID único de mensagem"""
        self._message_counter += 1
        return f"projects/test-project/messages/{self._message_counter}"
    
    async def send(self, message: MockFirebaseMessage, dry_run: bool = False) -> str:
        """
        Mock: Enviar notificação única
        
        Retorna o message_id se sucesso, levanta exceção se falha.
        """
        if self.should_fail or (message.token in self.fail_tokens):
            raise Exception("Simulated FCM send failure")
        
        message_id = self._generate_message_id()
        
        # Registrar mensagem enviada
        self.sent_messages.append({
            "message_id": message_id,
            "token": message.token,
            "notification": {
                "title": message.notification.title if message.notification else None,
                "body": message.notification.body if message.notification else None,
                "image": message.notification.image if message.notification else None,
            } if message.notification else None,
            "data": message.data,
            "dry_run": dry_run,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        return message_id
    
    async def send_multicast(self, message: MockFirebaseMessage, tokens: List[str], dry_run: bool = False) -> MockBatchResponse:
        """
        Mock: Enviar notificação para múltiplos tokens
        
        Retorna BatchResponse com status de cada envio.
        """
        responses = []
        success_count = 0
        failure_count = 0
        
        for token in tokens:
            if self.should_fail or token in self.fail_tokens:
                # Simular falha
                responses.append(MockSendResponse(exception=Exception("Simulated failure")))
                failure_count += 1
            else:
                # Simular sucesso
                message_id = self._generate_message_id()
                responses.append(MockSendResponse(message_id=message_id))
                success_count += 1
                
                # Registrar mensagem enviada
                self.sent_multicast.append({
                    "message_id": message_id,
                    "token": token,
                    "notification": {
                        "title": message.notification.title if message.notification else None,
                        "body": message.notification.body if message.notification else None,
                        "image": message.notification.image if message.notification else None,
                    } if message.notification else None,
                    "data": message.data,
                    "dry_run": dry_run,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
        
        return MockBatchResponse(responses, success_count, failure_count)
    
    async def send_all(self, messages: List[MockFirebaseMessage], dry_run: bool = False) -> MockBatchResponse:
        """
        Mock: Enviar múltiplas mensagens
        
        Retorna BatchResponse com status de cada envio.
        """
        responses = []
        success_count = 0
        failure_count = 0
        
        for message in messages:
            try:
                message_id = await self.send(message, dry_run)
                responses.append(MockSendResponse(message_id=message_id))
                success_count += 1
            except Exception as e:
                responses.append(MockSendResponse(exception=e))
                failure_count += 1
        
        return MockBatchResponse(responses, success_count, failure_count)
    
    async def send_to_topic(self, topic: str, message: MockFirebaseMessage, dry_run: bool = False) -> str:
        """
        Mock: Enviar notificação para tópico
        
        Retorna message_id se sucesso.
        """
        if self.should_fail:
            raise Exception("Simulated FCM send failure")
        
        message_id = self._generate_message_id()
        
        # Registrar mensagem enviada
        self.sent_messages.append({
            "message_id": message_id,
            "topic": topic,
            "notification": {
                "title": message.notification.title if message.notification else None,
                "body": message.notification.body if message.notification else None,
            } if message.notification else None,
            "data": message.data,
            "dry_run": dry_run,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        return message_id
    
    def get_sent_messages(self, token: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Utilitário de teste: Obter histórico de mensagens enviadas
        
        Args:
            token: Se fornecido, filtra apenas mensagens para este token
            
        Returns:
            Lista de mensagens enviadas
        """
        if token:
            return [msg for msg in self.sent_messages + self.sent_multicast if msg.get("token") == token]
        return self.sent_messages + self.sent_multicast
    
    def get_last_message(self, token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Utilitário de teste: Obter última mensagem enviada
        
        Args:
            token: Se fornecido, obtém última mensagem para este token
            
        Returns:
            Última mensagem enviada ou None
        """
        messages = self.get_sent_messages(token)
        return messages[-1] if messages else None
    
    def reset(self):
        """Limpar histórico de mensagens (útil entre testes)"""
        self.sent_messages.clear()
        self.sent_multicast.clear()
        self._message_counter = 0
        self.should_fail = False
        self.fail_tokens.clear()
    
    def configure_failure(self, should_fail: bool = True, fail_tokens: Optional[List[str]] = None):
        """
        Configurar comportamento de falha para testes
        
        Args:
            should_fail: Se True, todas as mensagens falham
            fail_tokens: Lista de tokens que devem falhar
        """
        self.should_fail = should_fail
        if fail_tokens:
            self.fail_tokens = fail_tokens


# Instância global para uso em testes
mock_firebase_messaging = MockFirebaseMessaging()


# Funções auxiliares para compatibilidade com firebase_admin API
def Message(**kwargs):
    """Helper para criar MockFirebaseMessage"""
    return MockFirebaseMessage(**kwargs)


def Notification(**kwargs):
    """Helper para criar MockFirebaseNotification"""
    return MockFirebaseNotification(**kwargs)


async def send(message: MockFirebaseMessage, dry_run: bool = False) -> str:
    """Wrapper para mock_firebase_messaging.send()"""
    return await mock_firebase_messaging.send(message, dry_run)


async def send_multicast(message: MockFirebaseMessage, tokens: List[str], dry_run: bool = False) -> MockBatchResponse:
    """Wrapper para mock_firebase_messaging.send_multicast()"""
    return await mock_firebase_messaging.send_multicast(message, tokens, dry_run)


async def send_all(messages: List[MockFirebaseMessage], dry_run: bool = False) -> MockBatchResponse:
    """Wrapper para mock_firebase_messaging.send_all()"""
    return await mock_firebase_messaging.send_all(messages, dry_run)
