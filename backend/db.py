"""
Tiny database layer for Smart Repute.

Production: set DATABASE_URL to your Render Postgres *internal* URL.
Local testing: leave DATABASE_URL unset and a throwaway SQLite file
is used instead. That file is NOT persistent on Render, so the health
endpoint reports it as "sqlite (temporary)".

SQL is written with ? placeholders and converted for Postgres.
"""

import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("smartrepute.db")


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "").strip()


def is_postgres() -> bool:
    return _database_url().startswith(
        ("postgres://", "postgresql://")
    )


def database_label() -> str:
    return "postgres" if is_postgres() else "sqlite (temporary)"


def _connect():
    if is_postgres():
        import psycopg2

        return psycopg2.connect(_database_url())

    return sqlite3.connect(
        os.getenv("SQLITE_PATH", "smartrepute_local.db")
    )


@contextmanager
def connection():
    conn = _connect()

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _sql(query: str) -> str:
    return query.replace("?", "%s") if is_postgres() else query


def _rows(cursor) -> list:
    columns = [c[0] for c in cursor.description]

    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SCHEMA = [
    """
    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        google_sub TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        picture TEXT,
        refresh_token_enc TEXT,
        consent_accepted_at TEXT,
        consent_version TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS active_business (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        google_account_id TEXT NOT NULL,
        location_id TEXT NOT NULL,
        location_title TEXT,
        updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reply_templates (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        five_star TEXT,
        middle TEXT,
        one_star TEXT,
        updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS example_replies (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        review_text TEXT NOT NULL,
        reply_text TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
]


def init_db() -> None:
    with connection() as conn:
        cur = conn.cursor()

        for statement in SCHEMA:
            cur.execute(statement)

    logger.info("Database ready (%s)", database_label())


def upsert_google_account(
    google_sub: str,
    email: str,
    name: Optional[str],
    picture: Optional[str],
    refresh_token_enc: Optional[str],
) -> dict:
    """
    Creates the account on first sign-in, updates it afterwards.
    A missing refresh token never overwrites one we already have.
    """
    now = _now()

    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                """
                INSERT INTO accounts (
                    id, google_sub, email, name, picture,
                    refresh_token_enc, created_at, last_login_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (google_sub) DO UPDATE SET
                    email = excluded.email,
                    name = excluded.name,
                    picture = excluded.picture,
                    last_login_at = excluded.last_login_at,
                    refresh_token_enc = COALESCE(
                        excluded.refresh_token_enc,
                        accounts.refresh_token_enc
                    )
                """
            ),
            (
                str(uuid.uuid4()),
                google_sub,
                email,
                name,
                picture,
                refresh_token_enc,
                now,
                now,
            ),
        )

        cur.execute(
            _sql("SELECT * FROM accounts WHERE google_sub = ?"),
            (google_sub,),
        )

        return _rows(cur)[0]


def get_account(account_id: str) -> Optional[dict]:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql("SELECT * FROM accounts WHERE id = ?"),
            (account_id,),
        )

        rows = _rows(cur)

        return rows[0] if rows else None


def clear_refresh_token(account_id: str) -> None:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "UPDATE accounts SET refresh_token_enc = NULL "
                "WHERE id = ?"
            ),
            (account_id,),
        )


def get_active_business(account_id: str) -> Optional[dict]:
    """The business this account last chose to work on, if any."""
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "SELECT google_account_id, location_id, location_title "
                "FROM active_business WHERE account_id = ?"
            ),
            (account_id,),
        )

        rows = _rows(cur)

        return rows[0] if rows else None


def set_active_business(
    account_id: str,
    google_account_id: str,
    location_id: str,
    location_title: Optional[str],
) -> None:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                """
                INSERT INTO active_business (
                    account_id, google_account_id, location_id,
                    location_title, updated_at
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (account_id) DO UPDATE SET
                    google_account_id = excluded.google_account_id,
                    location_id = excluded.location_id,
                    location_title = excluded.location_title,
                    updated_at = excluded.updated_at
                """
            ),
            (
                account_id,
                google_account_id,
                location_id,
                location_title,
                _now(),
            ),
        )


def record_consent(account_id: str, version: str) -> None:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "UPDATE accounts SET consent_accepted_at = ?, "
                "consent_version = ? WHERE id = ?"
            ),
            (_now(), version, account_id),
        )


def get_reply_templates(account_id: str) -> dict:
    """Always returns all three keys; unset ones are empty strings."""
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "SELECT five_star, middle, one_star "
                "FROM reply_templates WHERE account_id = ?"
            ),
            (account_id,),
        )

        rows = _rows(cur)

    row = rows[0] if rows else {}

    return {
        "five_star": row.get("five_star") or "",
        "middle": row.get("middle") or "",
        "one_star": row.get("one_star") or "",
    }


def set_reply_templates(
    account_id: str,
    five_star: str,
    middle: str,
    one_star: str,
) -> None:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                """
                INSERT INTO reply_templates (
                    account_id, five_star, middle, one_star, updated_at
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (account_id) DO UPDATE SET
                    five_star = excluded.five_star,
                    middle = excluded.middle,
                    one_star = excluded.one_star,
                    updated_at = excluded.updated_at
                """
            ),
            (account_id, five_star, middle, one_star, _now()),
        )


MAX_EXAMPLE_REPLIES = 10


def add_example_reply(
    account_id: str,
    rating: int,
    review_text: str,
    reply_text: str,
) -> dict:
    """
    Saves one of the business's own replies as a style example for
    future AI drafts. Keeps only the most recent MAX_EXAMPLE_REPLIES
    per account -- older ones are dropped automatically so the
    prompt this feeds into never grows unbounded.
    """
    new_id = str(uuid.uuid4())

    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                """
                INSERT INTO example_replies (
                    id, account_id, rating, review_text,
                    reply_text, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """
            ),
            (
                new_id,
                account_id,
                rating,
                review_text,
                reply_text,
                _now(),
            ),
        )

        cur.execute(
            _sql(
                "SELECT id FROM example_replies "
                "WHERE account_id = ? "
                "ORDER BY created_at DESC"
            ),
            (account_id,),
        )

        ids = [row[0] for row in cur.fetchall()]

        stale_ids = ids[MAX_EXAMPLE_REPLIES:]

        for stale_id in stale_ids:
            cur.execute(
                _sql(
                    "DELETE FROM example_replies WHERE id = ?"
                ),
                (stale_id,),
            )

    return {
        "id": new_id,
        "rating": rating,
        "review_text": review_text,
        "reply_text": reply_text,
    }


def list_example_replies(account_id: str) -> list:
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "SELECT id, rating, review_text, reply_text "
                "FROM example_replies WHERE account_id = ? "
                "ORDER BY created_at DESC"
            ),
            (account_id,),
        )

        return _rows(cur)


def delete_example_reply(
    account_id: str, example_id: str
) -> None:
    """Scoped to account_id -- one business can never delete another's."""
    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "DELETE FROM example_replies "
                "WHERE id = ? AND account_id = ?"
            ),
            (example_id, account_id),
        )


def examples_for_bucket(
    account_id: str,
    ratings: tuple,
    limit: int = 2,
) -> list:
    """Most recent examples whose rating is in `ratings`, for the prompt."""
    placeholders = ", ".join(["?"] * len(ratings))

    with connection() as conn:
        cur = conn.cursor()

        cur.execute(
            _sql(
                "SELECT review_text, reply_text FROM example_replies "
                f"WHERE account_id = ? AND rating IN ({placeholders}) "
                "ORDER BY created_at DESC LIMIT ?"
            ),
            (account_id, *ratings, limit),
        )

        return _rows(cur)
