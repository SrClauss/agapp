import pytest

from app.core import firebase

class DummyUser:
    def __init__(self, uid):
        self.uid = uid


def test_create_or_update_firebase_user_creates_new(monkeypatch):
    # Simular initialize_firebase funcionando
    monkeypatch.setattr(firebase, "_firebase_app", object())

    class FakeAuth:
        @staticmethod
        def get_user_by_email(email):
            raise Exception("User not found")

        @staticmethod
        def create_user(email, password, display_name=None):
            return DummyUser("created-uid")

    monkeypatch.setitem(__import__("sys").modules, 'firebase_admin.auth', FakeAuth)

    uid = firebase.create_or_update_firebase_user("test@example.com", "secret", display_name="Test")
    assert uid == "created-uid"


def test_create_or_update_firebase_user_updates_existing(monkeypatch):
    monkeypatch.setattr(firebase, "_firebase_app", object())

    class ExistingUser:
        def __init__(self, uid):
            self.uid = uid

    class FakeAuth:
        @staticmethod
        def get_user_by_email(email):
            return ExistingUser("existing-uid")

        @staticmethod
        def update_user(uid, **kwargs):
            # ensure password present
            assert "password" in kwargs
            return ExistingUser(uid)

    monkeypatch.setitem(__import__("sys").modules, 'firebase_admin.auth', FakeAuth)

    uid = firebase.create_or_update_firebase_user("test@example.com", "newpass", display_name="Test")
    assert uid == "existing-uid"