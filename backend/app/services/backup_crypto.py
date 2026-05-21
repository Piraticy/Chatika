import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _build_fernet_key(raw_secret: str) -> bytes:
    digest = hashlib.sha256(raw_secret.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_text(plaintext: str) -> str:
    f = Fernet(_build_fernet_key(settings.backup_encryption_key))
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_text(ciphertext: str) -> str:
    f = Fernet(_build_fernet_key(settings.backup_encryption_key))
    return f.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
