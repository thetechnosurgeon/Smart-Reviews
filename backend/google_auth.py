"""
Google sign-in and per-account API access for Smart Repute.

Each business owner signs in with their own Google account. We keep
only their (encrypted) refresh token in the database and fetch a fresh
short-lived access token whenever we need to call Google for them.
"""

import logging
import os
import time
from typing import Optional
from urllib.parse import urlencode

import requests

import db
import security

logger = logging.getLogger("smartrepute.google")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"

BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage"
SCOPES = f"openid email profile {BUSINESS_SCOPE}"


class GoogleAuthError(Exception):
    def __init__(self, code: str, message: str, status: int = 401):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _client() -> tuple:
    return (
        os.getenv("GOOGLE_CLIENT_ID", "").strip(),
        os.getenv("GOOGLE_CLIENT_SECRET", "").strip(),
    )


def client_is_configured() -> bool:
    client_id, client_secret = _client()
    return bool(client_id and client_secret)


def redirect_uri() -> str:
    base = os.getenv(
        "API_BASE_URL", "https://smart-reviews.onrender.com"
    ).rstrip("/")

    return f"{base}/auth/google/callback"


def build_auth_url(state: str) -> str:
    client_id, _ = _client()

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    return AUTH_URL + "?" + urlencode(params)


# Short-lived access tokens are only a cache. The refresh token in the
# database is the source of truth.
_access_cache: dict = {}


def _cache_token(account_id: str, token: str, expires_in) -> None:
    try:
        lifetime = int(expires_in)
    except (TypeError, ValueError):
        lifetime = 3600

    _access_cache[account_id] = (
        token,
        time.time() + max(lifetime - 60, 0),
    )


def _cached_token(account_id: str) -> Optional[str]:
    entry = _access_cache.get(account_id)

    if entry and entry[1] > time.time():
        return entry[0]

    return None


def _drop_cached_token(account_id: str) -> None:
    _access_cache.pop(account_id, None)


def complete_login(code: str) -> dict:
    """
    Finishes sign-in after Google redirects back with a code.
    Returns the account row.
    """
    client_id, client_secret = _client()

    token_response = requests.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=30,
    )

    if token_response.status_code != 200:
        logger.warning(
            "Token exchange failed: %s", token_response.text[:300]
        )
        raise GoogleAuthError(
            "token_exchange_failed",
            "Google rejected the sign-in. Please try again.",
        )

    tokens = token_response.json()

    granted = str(tokens.get("scope", "")).split()

    if BUSINESS_SCOPE not in granted:
        raise GoogleAuthError(
            "missing_business_scope",
            "Access to your Business Profile was not granted.",
        )

    access_token = tokens.get("access_token")

    profile_response = requests.get(
        USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )

    if profile_response.status_code != 200:
        raise GoogleAuthError(
            "userinfo_failed",
            "Could not read your Google profile.",
        )

    profile = profile_response.json()

    google_sub = profile.get("sub")
    email = profile.get("email")

    if not google_sub or not email:
        raise GoogleAuthError(
            "userinfo_failed",
            "Google did not return your account details.",
        )

    refresh_token = tokens.get("refresh_token")

    account = db.upsert_google_account(
        google_sub=google_sub,
        email=email,
        name=profile.get("name"),
        picture=profile.get("picture"),
        refresh_token_enc=(
            security.encrypt_token(refresh_token)
            if refresh_token
            else None
        ),
    )

    if not account.get("refresh_token_enc"):
        raise GoogleAuthError(
            "no_refresh_token",
            "Google did not grant offline access. Please try again.",
        )

    _cache_token(
        account["id"], access_token, tokens.get("expires_in")
    )

    return account


def get_access_token(account: dict, force_refresh: bool = False) -> str:
    if not force_refresh:
        cached = _cached_token(account["id"])

        if cached:
            return cached

    refresh_token = security.decrypt_token(
        account.get("refresh_token_enc")
    )

    if not refresh_token:
        raise GoogleAuthError(
            "not_connected",
            "Google account not connected. Please sign in again.",
        )

    client_id, client_secret = _client()

    response = requests.post(
        TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )

    if response.status_code != 200:
        try:
            error_code = response.json().get("error")
        except Exception:
            error_code = None

        if error_code == "invalid_grant":
            # Access was revoked or expired on Google's side.
            db.clear_refresh_token(account["id"])
            _drop_cached_token(account["id"])

            raise GoogleAuthError(
                "not_connected",
                "Google access was revoked or expired. "
                "Please sign in again.",
            )

        raise GoogleAuthError(
            "token_refresh_failed",
            "Could not refresh Google access. Please try again.",
            status=502,
        )

    data = response.json()

    _cache_token(
        account["id"],
        data["access_token"],
        data.get("expires_in"),
    )

    return data["access_token"]


def google_request(account: dict, method: str, url: str, **kwargs):
    """
    Calls a Google API as this account. Retries once with a fresh
    token if Google says the cached one is no longer valid.
    """
    headers = kwargs.pop("headers", None) or {}
    kwargs.setdefault("timeout", 30)

    token = get_access_token(account)

    response = requests.request(
        method,
        url,
        headers={**headers, "Authorization": f"Bearer {token}"},
        **kwargs,
    )

    if response.status_code == 401:
        token = get_access_token(account, force_refresh=True)

        response = requests.request(
            method,
            url,
            headers={**headers, "Authorization": f"Bearer {token}"},
            **kwargs,
        )

    return response


def disconnect(account: dict) -> None:
    """Revokes access at Google and forgets the stored token."""
    refresh_token = security.decrypt_token(
        account.get("refresh_token_enc")
    )

    if refresh_token:
        try:
            requests.post(
                REVOKE_URL,
                data={"token": refresh_token},
                timeout=15,
            )
        except Exception:
            logger.warning("Could not reach Google to revoke token")

    db.clear_refresh_token(account["id"])
    _drop_cached_token(account["id"])
