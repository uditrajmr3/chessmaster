"""Round-trip tests for the Fernet-based secret encryption helper used to
store a user's own Anthropic API key at rest."""

from cryptography.fernet import Fernet

from app import config
from app.services import crypto


def test_encrypt_decrypt_round_trip(monkeypatch):
    monkeypatch.setattr(config.settings, "encryption_key", Fernet.generate_key().decode())
    token = crypto.encrypt("sk-ant-secret-value")
    assert token != "sk-ant-secret-value"
    assert crypto.decrypt(token) == "sk-ant-secret-value"


def test_decrypt_garbage_returns_none(monkeypatch):
    monkeypatch.setattr(config.settings, "encryption_key", Fernet.generate_key().decode())
    assert crypto.decrypt("not-a-valid-token") is None


def test_encrypt_without_key_raises(monkeypatch):
    monkeypatch.setattr(config.settings, "encryption_key", "")
    try:
        crypto.encrypt("x")
        assert False, "expected RuntimeError"
    except RuntimeError:
        pass
