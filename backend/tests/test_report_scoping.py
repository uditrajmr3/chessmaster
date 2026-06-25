"""Task 13: Report generation scoped to the authenticated user.

Covers:
- All three report endpoints require auth (401 when unauthenticated)
- report/latest is per-user: user A cannot see user B's report
- ReportGenerator stores Report rows stamped with the correct user_id
- ReportGenerator only queries the requesting user's Games
- The Anthropic LLM call is patched to avoid network / key requirements
"""

import asyncio
import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status

from app.models import Game, Report
from app.services.report_generator import ReportGenerator
from tests.conftest import TEST_USER_ID, make_game


# ── Helpers ──────────────────────────────────────────────────────────────────

CANNED_REPORT_TEXT = "Canned coaching report from mock LLM."

OTHER_USER_ID = str(uuid.uuid4())


def _make_anthropic_mock():
    """Return a mock that looks like anthropic.AsyncAnthropic.messages.create."""
    msg = MagicMock()
    msg.content = [MagicMock(text=CANNED_REPORT_TEXT)]

    client_mock = MagicMock()
    client_mock.messages.create = AsyncMock(return_value=msg)
    return client_mock


def _seed_report_for_user(db, user_id: str) -> Report:
    """Insert a Report row directly for a given user (no LLM needed)."""
    r = Report(
        user_id=user_id,
        generated_at=datetime.utcnow(),
        games_count=1,
        report_json=json.dumps({"opening_stats": []}),
        report_text="test report for user " + str(user_id),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _seed_game_for_user(db, user_id: str, game_suffix: str = "") -> Game:
    """Insert a minimal Game row for a given user."""
    uid_prefix = str(user_id)[:8] if len(str(user_id)) >= 8 else str(user_id)
    return make_game(
        db,
        id=f"lichess_rpt_{uid_prefix}{game_suffix}",
        user_id=user_id,
        platform="lichess",
        platform_id=f"rpt_{uid_prefix}{game_suffix}",
    )


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestReportRequiresAuth:
    """All three report endpoints must return 401 when unauthenticated."""

    def test_generate_requires_auth(self, client):
        resp = client.post("/api/report/generate")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_status_requires_auth(self, client):
        resp = client.get("/api/report/status")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_latest_requires_auth(self, client):
        resp = client.get("/api/report/latest")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ── Per-user isolation tests ──────────────────────────────────────────────────

class TestReportLatestIsPerUser:
    """report/latest only returns reports belonging to the authenticated user."""

    def test_user_sees_own_report(self, verified_user_client, db):
        """The authed user can retrieve a report seeded under their account."""
        # Get the authed user's real id from /api/users/me
        uid = verified_user_client.get("/api/users/me").json()["id"]

        _seed_report_for_user(db, uid)

        resp = verified_user_client.get("/api/report/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert "test report for user" in data["report_text"]

    def test_user_does_not_see_other_users_report(self, verified_user_client, db):
        """A report seeded for OTHER_USER_ID must NOT appear for the authed user."""
        # Seed a report for a completely different user
        _seed_report_for_user(db, OTHER_USER_ID)

        resp = verified_user_client.get("/api/report/latest")
        assert resp.status_code == 200
        # The authed user has no reports; should be null
        assert resp.json() is None

    def test_latest_returns_most_recent_own_report(self, verified_user_client, db):
        """Among multiple reports for the same user, the newest is returned."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        r1 = _seed_report_for_user(db, uid)
        r2 = _seed_report_for_user(db, uid)

        resp = verified_user_client.get("/api/report/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        # r2 was inserted later; it should be the one returned
        assert data["id"] == r2.id


# ── Service-level tests ───────────────────────────────────────────────────────

class TestReportGeneratorScoping:
    """Unit-tests for ReportGenerator with the Anthropic client mocked."""

    def test_generator_requires_user_id(self, db):
        with pytest.raises(ValueError, match="user_id"):
            ReportGenerator(db, user_id=None)

    def test_generator_stores_report_with_user_id(self, db):
        """generate() saves Report with correct user_id and uses ONLY that user's games."""
        # Seed one game for TEST_USER_ID and one for another user
        _seed_game_for_user(db, TEST_USER_ID, "_main")
        _seed_game_for_user(db, OTHER_USER_ID, "_other")

        generator = ReportGenerator(db, user_id=TEST_USER_ID)

        anthropic_mock = _make_anthropic_mock()
        with patch("app.services.report_generator.anthropic.AsyncAnthropic", return_value=anthropic_mock), \
             patch("app.services.report_generator.settings") as mock_settings:
            mock_settings.anthropic_api_key = "test-key"
            report = asyncio.run(generator.generate())

        # Report row must be stamped with TEST_USER_ID
        assert str(report.user_id) == TEST_USER_ID
        # The LLM was fed exactly the authed user's games (1 game, not 2)
        assert report.games_count == 1
        assert report.report_text == CANNED_REPORT_TEXT

    def test_generator_raises_on_no_games(self, db):
        """If the user has no games, generate() raises RuntimeError."""
        # OTHER_USER_ID has a game but TEST_USER_ID has none
        _seed_game_for_user(db, OTHER_USER_ID, "_decoy")

        generator = ReportGenerator(db, user_id=TEST_USER_ID)
        anthropic_mock = _make_anthropic_mock()
        with patch("app.services.report_generator.anthropic.AsyncAnthropic", return_value=anthropic_mock), \
             patch("app.services.report_generator.settings") as mock_settings:
            mock_settings.anthropic_api_key = "test-key"
            with pytest.raises(RuntimeError, match="No games found"):
                asyncio.run(generator.generate())

    def test_generated_report_queryable_by_user_id(self, db):
        """After generation the Report row is retrievable via user_id filter."""
        _seed_game_for_user(db, TEST_USER_ID, "_q")

        generator = ReportGenerator(db, user_id=TEST_USER_ID)
        anthropic_mock = _make_anthropic_mock()
        with patch("app.services.report_generator.anthropic.AsyncAnthropic", return_value=anthropic_mock), \
             patch("app.services.report_generator.settings") as mock_settings:
            mock_settings.anthropic_api_key = "test-key"
            asyncio.run(generator.generate())

        # Query as if the router's get_latest_report does it
        report = (
            db.query(Report)
            .filter(Report.user_id == TEST_USER_ID)
            .order_by(Report.generated_at.desc())
            .first()
        )
        assert report is not None
        assert str(report.user_id) == TEST_USER_ID

        # The OTHER user must see no report
        other_report = (
            db.query(Report)
            .filter(Report.user_id == OTHER_USER_ID)
            .first()
        )
        assert other_report is None
