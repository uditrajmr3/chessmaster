import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_scan_endpoint_requires_no_authentication():
    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": "alice"})
    assert r.status_code != 401 and r.status_code != 403


@pytest.mark.parametrize("bad", ["ab", "a" * 26, "bad user", "drop;table", "../etc"])
def test_invalid_usernames_are_rejected_before_any_outbound_call(bad):
    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": bad})
    assert r.status_code == 422


def test_unknown_job_id_returns_404():
    assert client.get("/api/awards/scan/00000000-0000-0000-0000-000000000000").status_code == 404


def test_router_does_not_depend_on_auth():
    import app.routers.awards as mod
    src = open(mod.__file__).read()
    assert "current_verified_user" not in src, "the awards router must stay public"
