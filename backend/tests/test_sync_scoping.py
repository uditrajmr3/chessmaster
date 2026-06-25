"""TDD tests for per-user sync scoping (Task 10).

Tests are written BEFORE the implementation changes so we can see RED -> GREEN.
"""
import asyncio
import uuid

import pytest

from tests.conftest import AsyncTestSession
from sqlalchemy import select, func
from app.auth.models import User


class TestSyncRequiresAuth:
    def test_post_sync_requires_auth(self, client):
        """Unauthenticated POST /api/sync → 401."""
        r = client.post("/api/sync")
        assert r.status_code == 401

    def test_get_sync_status_requires_auth(self, client):
        """Unauthenticated GET /api/sync/status → 401."""
        r = client.get("/api/sync/status")
        assert r.status_code == 401


class TestSyncLinkedUsername:
    def test_sync_requires_a_linked_username(self, verified_user_client):
        """A freshly verified user with no usernames → POST /api/sync returns 400."""
        r = verified_user_client.post("/api/sync")
        assert r.status_code == 400
        data = r.json()
        assert "detail" in data

    def test_sync_uses_stored_usernames(self, verified_user_client, monkeypatch):
        """PATCH /api/users/me to set lichess_username; monkeypatched fetch → 200."""
        # Set a lichess username
        patch_r = verified_user_client.patch(
            "/api/users/me", json={"lichess_username": "magnus"}
        )
        assert patch_r.status_code == 200

        # Monkeypatch LichessClient.fetch_games and ChessComClient.fetch_games
        # to avoid real HTTP calls
        import app.services.sync_service as sync_mod

        async def fake_lichess_fetch(self, username):
            return []

        async def fake_chesscom_fetch(self, username):
            return []

        monkeypatch.setattr(sync_mod.LichessClient, "fetch_games", fake_lichess_fetch)
        monkeypatch.setattr(sync_mod.ChessComClient, "fetch_games", fake_chesscom_fetch)

        r = verified_user_client.post("/api/sync")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert data["message"] in ("Sync started", "Sync already in progress")

    def test_sync_already_in_progress_returns_message(self, verified_user_client, monkeypatch):
        """If sync is already in progress for this user, return a message (not an error)."""
        # Set a username
        verified_user_client.patch(
            "/api/users/me", json={"lichess_username": "testuser"}
        )

        import app.services.sync_service as sync_mod

        async def fake_lichess_fetch(self, username):
            return []

        async def fake_chesscom_fetch(self, username):
            return []

        monkeypatch.setattr(sync_mod.LichessClient, "fetch_games", fake_lichess_fetch)
        monkeypatch.setattr(sync_mod.ChessComClient, "fetch_games", fake_chesscom_fetch)

        # Force status to "syncing" for this user
        import app.routers.sync as sync_router

        uid = verified_user_client.get("/api/users/me").json()["id"]
        sync_router._sync_status[uid] = {"status": "syncing", "games_fetched": 0, "message": ""}

        r = verified_user_client.post("/api/sync")
        assert r.status_code == 200
        assert r.json()["message"] == "Sync already in progress"

        # Clean up
        sync_router._sync_status.pop(uid, None)


class TestSyncStatusPerUser:
    def test_sync_status_returns_idle_when_no_sync(self, verified_user_client):
        """GET /api/sync/status returns idle for a user who hasn't synced."""
        r = verified_user_client.get("/api/sync/status")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "idle"
        assert data["games_fetched"] == 0

    def test_sync_status_is_per_user(self, client, db, monkeypatch):
        """Two different users see independent sync statuses."""
        import app.routers.sync as sync_router

        # Register and verify two users
        async def register_and_verify(email, pw):
            r = client.post("/api/auth/register", json={"email": email, "password": pw})
            assert r.status_code == 201, r.text
            async with AsyncTestSession() as session:
                result = await session.execute(
                    select(User).where(func.lower(User.email) == email)
                )
                u = result.scalar_one()
                u.is_verified = True
                await session.commit()

        asyncio.run(register_and_verify("user1@test.com", "pw12345678"))
        asyncio.run(register_and_verify("user2@test.com", "pw12345678"))

        from fastapi.testclient import TestClient
        from app.main import app

        with TestClient(app) as c1:
            c1.post("/api/auth/login", data={"username": "user1@test.com", "password": "pw12345678"})
            uid1 = c1.get("/api/users/me").json()["id"]
            # Manually set a status for user1
            sync_router._sync_status[uid1] = {"status": "done", "games_fetched": 5, "message": ""}

            with TestClient(app) as c2:
                c2.post("/api/auth/login", data={"username": "user2@test.com", "password": "pw12345678"})
                uid2 = c2.get("/api/users/me").json()["id"]
                # user2 should see idle (not user1's done)
                r2 = c2.get("/api/sync/status")
                assert r2.status_code == 200
                assert r2.json()["status"] == "idle"

            r1 = c1.get("/api/sync/status")
            assert r1.status_code == 200
            assert r1.json()["status"] == "done"
            assert r1.json()["games_fetched"] == 5

        # Clean up
        sync_router._sync_status.pop(uid1, None)


class TestSyncInsertsWithUserIdAndUUID:
    def test_games_stamped_with_user_id_and_uuid(self, verified_user_client, db):
        """_insert_games stamps user_id and a UUID id (not platform_platform_id).

        We call _insert_games directly with the test DB session so we don't need
        the background task to share the in-memory DB session.
        """
        uid = verified_user_client.get("/api/users/me").json()["id"]

        from datetime import datetime
        from app.services.sync_service import SyncService
        from app.models import Game

        fake_game = {
            "platform": "lichess",
            "platform_id": "abc123",
            "pgn": '[Event "Test"]\n1. e4 e5 *',
            "white_username": "testplayer",
            "black_username": "opponent",
            "player_color": "white",
            "time_class": "rapid",
            "time_control": "600",
            "result": "win",
            "result_detail": "resign",
            "player_rating": 1500,
            "opponent_rating": 1480,
            "opening_eco": "C20",
            "opening_name": "King's Pawn Game",
            "num_moves": 30,
            "played_at": datetime(2025, 6, 15, 12, 0),
        }

        service = SyncService()
        inserted = service._insert_games(db, uid, [fake_game])
        assert inserted == 1

        games = db.query(Game).filter_by(user_id=uid).all()
        assert len(games) == 1
        g = games[0]
        assert g.platform == "lichess"
        assert g.platform_id == "abc123"
        assert str(g.user_id) == uid
        # id must be a valid UUID (not "lichess_abc123")
        parsed_id = uuid.UUID(g.id)  # raises ValueError if not UUID
        assert str(parsed_id) == g.id

    def test_dedupe_by_user_platform_platform_id(self, verified_user_client, db):
        """Inserting the same (user_id, platform, platform_id) twice inserts only once."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        from datetime import datetime
        from app.services.sync_service import SyncService
        from app.models import Game

        fake_game = {
            "platform": "chesscom",
            "platform_id": "dup001",
            "pgn": '[Event "Test"]\n1. d4 d5 *',
            "white_username": "player",
            "black_username": "opponent",
            "player_color": "white",
            "time_class": "blitz",
            "time_control": "180",
            "result": "loss",
            "result_detail": "checkmated",
            "player_rating": 1400,
            "opponent_rating": 1450,
            "opening_eco": "D00",
            "opening_name": "Queen's Pawn",
            "num_moves": 25,
            "played_at": datetime(2025, 6, 10, 9, 0),
        }

        service = SyncService()
        first = service._insert_games(db, uid, [fake_game])
        second = service._insert_games(db, uid, [fake_game])

        assert first == 1
        assert second == 0  # deduplicated

        games = db.query(Game).filter_by(user_id=uid, platform="chesscom", platform_id="dup001").all()
        assert len(games) == 1
