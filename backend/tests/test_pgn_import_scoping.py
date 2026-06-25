"""TDD tests for per-user PGN import scoping (Task 11).

These tests are written FIRST (RED), then the implementation is wired up (GREEN).
"""
import uuid
from unittest.mock import patch

import pytest

from app.models import Game
from app.services.pgn_import import import_pgn

SAMPLE_PGN = """[Event "Casual Game"]
[Site "OTB"]
[Date "2025.06.15"]
[White "testuser"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1200"]
[BlackElo "1100"]
[ECO "B12"]
[Opening "Caro-Kann Defense"]
[TimeControl "600"]

1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Nd7 1-0
"""


class TestImportRequiresAuth:
    def test_import_requires_auth_pgn_text(self, client):
        """Unauthenticated POST /api/import/pgn-text → 401."""
        r = client.post("/api/import/pgn-text", json={"pgn": SAMPLE_PGN})
        assert r.status_code == 401

    def test_import_requires_auth_pgn_file(self, client):
        """Unauthenticated POST /api/import/pgn → 401."""
        r = client.post(
            "/api/import/pgn",
            files={"file": ("test.pgn", SAMPLE_PGN.encode(), "text/plain")},
        )
        assert r.status_code == 401


class TestImportedGamesBelongToUser:
    def test_imported_games_belong_to_authed_user(self, verified_user_client, db):
        """Authenticated user imports a PGN; games carry that user's user_id."""
        # Get the authenticated user's id
        me_r = verified_user_client.get("/api/users/me")
        assert me_r.status_code == 200
        authed_uid = me_r.json()["id"]

        # Import a small valid PGN
        resp = verified_user_client.post(
            "/api/import/pgn-text",
            json={"pgn": SAMPLE_PGN},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 1
        assert data["skipped"] == 0

        # Verify the game carries the authenticated user's user_id
        games = db.query(Game).filter_by(user_id=authed_uid).all()
        assert len(games) == 1
        g = games[0]
        assert str(g.user_id) == authed_uid
        assert g.platform == "pgn"

    def test_imported_games_not_visible_to_other_user(self, client, db):
        """Games imported by user A are not visible to user B via /api/games."""
        import asyncio
        from sqlalchemy import select, func
        from tests.conftest import AsyncTestSession
        from app.auth.models import User
        from fastapi.testclient import TestClient
        from app.main import app

        # Register and verify two users
        async def register_and_verify(email, pw):
            r = client.post("/api/auth/register", json={"email": email, "password": pw})
            assert r.status_code in (201, 400), r.text  # 400 if already exists (cross-test)
            async with AsyncTestSession() as session:
                result = await session.execute(
                    select(User).where(func.lower(User.email) == email)
                )
                u = result.scalar_one_or_none()
                if u:
                    u.is_verified = True
                    await session.commit()

        asyncio.run(register_and_verify("pgn_user_a@test.com", "pw12345678"))
        asyncio.run(register_and_verify("pgn_user_b@test.com", "pw12345678"))

        with TestClient(app) as ca:
            ca.post("/api/auth/login", data={"username": "pgn_user_a@test.com", "password": "pw12345678"})
            resp = ca.post("/api/import/pgn-text", json={"pgn": SAMPLE_PGN})
            assert resp.status_code == 200
            assert resp.json()["imported"] == 1
            uid_a = ca.get("/api/users/me").json()["id"]

            games_a = ca.get("/api/games").json()
            assert len(games_a) == 1

            with TestClient(app) as cb:
                cb.post("/api/auth/login", data={"username": "pgn_user_b@test.com", "password": "pw12345678"})
                games_b = cb.get("/api/games").json()
                # User B should see no games
                assert len(games_b) == 0

    def test_placeholder_user_id_not_used(self, verified_user_client, db):
        """Imported games must NOT use the placeholder UUID (all-zeros)."""
        PLACEHOLDER = "00000000-0000-0000-0000-000000000001"

        resp = verified_user_client.post(
            "/api/import/pgn-text",
            json={"pgn": SAMPLE_PGN},
        )
        assert resp.status_code == 200
        assert resp.json()["imported"] == 1

        games = db.query(Game).all()
        for g in games:
            assert str(g.user_id) != PLACEHOLDER, (
                f"Game {g.id} still uses placeholder user_id!"
            )

    def test_pgn_file_upload_belongs_to_authed_user(self, verified_user_client, db):
        """File upload endpoint also scopes to authenticated user."""
        me_r = verified_user_client.get("/api/users/me")
        authed_uid = me_r.json()["id"]

        resp = verified_user_client.post(
            "/api/import/pgn",
            files={"file": ("test.pgn", SAMPLE_PGN.encode(), "text/plain")},
        )
        assert resp.status_code == 200
        assert resp.json()["imported"] == 1

        games = db.query(Game).filter_by(user_id=authed_uid).all()
        assert len(games) == 1
        assert str(games[0].user_id) == authed_uid


class TestDedupePerUser:
    def test_dedupe_by_user_platform_platform_id(self, db):
        """Service-layer dedup: inserting the same (user_id, platform, platform_id) twice
        results in exactly one Game row; the second insert is skipped.

        Strategy: pin uuid.uuid4 to a fixed value so both import_pgn calls generate
        the same platform_id, exercising the filter_by(user_id, platform, platform_id)
        dedup branch in _import_single_game.  Without that branch the second call would
        produce a duplicate row and the len==1 assertion would fail.
        """
        FIXED_UUID = "aaaabbbbcccc-dddd-eeee-ffff-000000000001"
        FIXED_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

        with patch("app.services.pgn_import.uuid.uuid4", return_value=FIXED_UUID):
            result1 = import_pgn(db, SAMPLE_PGN, ["testuser"], FIXED_USER_ID)
            result2 = import_pgn(db, SAMPLE_PGN, ["testuser"], FIXED_USER_ID)

        assert result1["imported"] == 1, "first import must succeed"
        assert result1["skipped"] == 0

        assert result2["imported"] == 0, "second import with same platform_id must be deduped"
        assert result2["skipped"] == 1, "second import must be reported as skipped"

        games = db.query(Game).filter_by(user_id=FIXED_USER_ID, platform="pgn").all()
        assert len(games) == 1, (
            "dedup guard must prevent duplicate (user_id, platform, platform_id) rows"
        )
