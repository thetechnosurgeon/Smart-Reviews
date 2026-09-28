"""
Security helpers for Smart Repute.

One environment variable, APP_SECRET (a random string of at least 32
characters), is used to derive two separate keys:
  - one that encrypts stored Google refresh tokens
  - one that signs login session cookies

Changing APP_SECRET later signs everyone out and makes stored tokens
unreadable, so people simply sign in with Google again.
"""

import base64
import hashlib
import hmac
import os
import secrets
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from itsdangerous import BadSignature, URLSafeTimedSerializer

SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


class SecretNotConfigured(RuntimeError):
    pass


def _secret() -> str:
    value = os.getenv("APP_SECRET", "").strip()

    if len(value) < 32:
        raise SecretNotConfigured(
            "APP_SECRET is missing or too short. Set it on the "
            "server to a random string of at least 32 characters."
        )

    return value


def secret_is_configured() -> bool:
    try:
        _secret()
        return True
    except SecretNotConfigured:
        return False


def _derive(label: str) -> bytes:
    return hashlib.sha256(
        f"{label}:{_secret()}".encode("utf-8")
    ).digest()


def _fernet() -> Fernet:
    return Fernet(
        base64.urlsafe_b64encode(_derive("token-encryption"))
    )


def encrypt_token(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted: Optional[str]) -> Optional[str]:
    """Returns None if there is nothing stored or it can't be decrypted."""
    if not encrypted:
        return None

    try:
        return _fernet().decrypt(
            encrypted.encode("utf-8")
        ).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def _session_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        _derive("session-signing").hex(),
        salt="smartrepute-session",
    )


def create_session_token(account_id: str) -> str:
    return _session_serializer().dumps({"a": account_id})


def read_session_token(
    token: Optional[str],
    max_age: int = SESSION_MAX_AGE,
) -> Optional[str]:
    """Returns the account id, or None if missing, tampered or expired."""
    if not token:
        return None

    try:
        data = _session_serializer().loads(token, max_age=max_age)
    except BadSignature:
        return None

    if isinstance(data, dict):
        return data.get("a")

    return None


def new_oauth_state() -> str:
    return secrets.token_urlsafe(24)


def states_match(
    from_google: Optional[str],
    from_cookie: Optional[str],
) -> bool:
    if not from_google or not from_cookie:
        return False

    return hmac.compare_digest(
        from_google.encode("utf-8"),
        from_cookie.encode("utf-8"),
    )
