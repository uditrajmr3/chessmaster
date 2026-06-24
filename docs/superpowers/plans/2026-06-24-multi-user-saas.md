# Multi-User SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert ChessMaster from a single-user tool into a public email+password SaaS where each user has isolated data and their own Lichess/Chess.com usernames, with Stockfish analysis run client-side.

**Architecture:** FastAPI + SQLAlchemy backend moves SQLite→Postgres (Alembic migrations). Auth via FastAPI-Users (email+password, verification, reset, JWT in httpOnly cookies). Every table gains `user_id`; every query is scoped to the authenticated user. Stockfish engine search runs in the browser (WASM Web Worker); the server keeps only classification + storage.

**Tech Stack:** FastAPI, FastAPI-Users, SQLAlchemy 2.x, Postgres (`psycopg`), Alembic, Resend (email), Next.js 16 / React 19, `chess.js`, `stockfish.wasm`.

## Global Constraints

- **Wipe and start fresh** — no migration of existing single-user data. Dev DB may be dropped freely.
- **Tenant isolation is security-critical** — every data query MUST filter by `current_user.id`. An unscoped query is a data-leak bug, not a style nit.
- **Server runs zero engine search** — no `chess.engine` calls in any request path after this plan.
- **Cross-origin cookies** — CORS `allow_credentials=True` with an explicit origin list (never `*`); auth cookies are `httpOnly`, `Secure` (prod), `SameSite=Lax` (dev) / `None` (prod cross-site).
- Python ≥ 3.11. All new IDs are UUID (`uuid.uuid4`).
- All backend money/secret config comes from env via `Settings`; never hardcode keys.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.

Run backend tests with: `cd backend && pytest` (uses `pytest-asyncio`).
Run frontend tests with: `cd frontend && npm test`.

---

## File Structure

**Backend — new files**
- `backend/app/auth/__init__.py`, `users.py` (FastAPI-Users manager/backend), `models.py` (User), `schemas.py` (UserRead/Create/Update), `deps.py` (`current_active_user`, `current_verified_user`).
- `backend/app/services/email_service.py` (Resend wrapper).
- `backend/app/services/analysis_ingest.py` (classify + store posted evals).
- `backend/alembic/` (migrations env + versions).
- `docker-compose.yml` (Postgres).
- Tests under `backend/tests/`.

**Backend — modified**
- `config.py`, `database.py`, `main.py`, `models.py`, `schemas.py`, all `routers/*.py`, `services/sync_service.py`, `services/pgn_import.py`, `services/stockfish_analyzer.py` (retired).

**Frontend — new files**
- `src/lib/auth.tsx` (AuthProvider/useAuth), `src/lib/engine.ts` (WASM worker wrapper), `src/lib/analyze.ts` (client analysis loop).
- `src/app/login/`, `register/`, `verify-email/`, `forgot-password/`, `reset-password/`, `settings/` pages.
- `src/components/AuthGuard.tsx`.
- `public/stockfish/` (WASM assets).

**Frontend — modified**
- `src/lib/api.ts`, `src/lib/types.ts`, `src/app/layout.tsx`, sync UI, `Sidebar.tsx`/`StatusBar.tsx`.

---

# Phase 0 — Postgres + Alembic Foundation

### Task 1: Postgres config, docker-compose, driver swap

**Files:**
- Modify: `backend/pyproject.toml` (deps), `backend/app/config.py`, `backend/app/database.py`, `backend/.env.example`
- Create: `docker-compose.yml`
- Test: `backend/tests/test_database_connection.py`

**Interfaces:**
- Produces: `settings.database_url` now a Postgres URL; `engine`/`SessionLocal` unchanged names.

- [ ] **Step 1: Add deps.** In `backend/pyproject.toml` dependencies add `"psycopg[binary]>=3.2.0"`, `"fastapi-users[sqlalchemy]>=14.0.0"`, `"resend>=2.0.0"`. Remove `"aiosqlite>=0.20.0"`. Then `cd backend && pip install -e ".[dev]"`.

- [ ] **Step 2: Create `docker-compose.yml`** at repo root:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: chessmaster
      POSTGRES_PASSWORD: chessmaster
      POSTGRES_DB: chessmaster
    ports:
      - "5432:5432"
    volumes:
      - chessmaster_pg:/var/lib/postgresql/data
volumes:
  chessmaster_pg:
```
Run: `docker compose up -d db`.

- [ ] **Step 3: Update `config.py`.** Change default and add auth/email fields:
```python
class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://chessmaster:chessmaster@localhost:5432/chessmaster"
    stockfish_path: str = ""
    anthropic_api_key: str = ""
    stockfish_depth: int = 20
    cors_origins: list[str] = ["http://localhost:3000"]
    secret_key: str = "CHANGE_ME_DEV_ONLY"
    access_token_lifetime: int = 3600
    resend_api_key: str = ""
    email_from: str = "ChessMaster <noreply@example.com>"
    frontend_url: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```
Keep `resolve_stockfish` (dev-only; no longer used in request paths).

- [ ] **Step 4: Update `database.py`** — remove SQLite-only `connect_args`:
```python
engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)
```

- [ ] **Step 5: Update `.env.example`** with the Postgres URL, `SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`.

- [ ] **Step 6: Write failing test** `backend/tests/test_database_connection.py`:
```python
from sqlalchemy import text
from app.database import engine

def test_postgres_connects():
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
```

- [ ] **Step 7: Run** `cd backend && pytest tests/test_database_connection.py -v` → PASS (requires `docker compose up -d db`).

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: switch backend to Postgres + add auth/email config"`.

---

### Task 2: Alembic baseline

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/`
- Modify: `backend/app/main.py` (remove `create_all`)

**Interfaces:**
- Produces: `alembic upgrade head` builds the full schema. `main.py` lifespan no longer calls `create_all`.

- [ ] **Step 1:** `cd backend && alembic init alembic`.

- [ ] **Step 2: Wire metadata** in `backend/alembic/env.py` — set `target_metadata`:
```python
from app.database import Base
from app import models  # noqa: F401 — register tables
from app.config import settings
config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
```

- [ ] **Step 3: Remove `create_all`** from `backend/app/main.py` lifespan (leave `yield`). Schema is owned by Alembic now.

- [ ] **Step 4: Generate baseline** (current models, pre-user): `alembic revision --autogenerate -m "baseline schema"` then `alembic upgrade head`.

- [ ] **Step 5: Verify** `alembic current` shows the revision. Commit `git add -A && git commit -m "feat: adopt Alembic migrations, drop create_all"`.

> Note: the User table + `user_id` columns get their own migration in Task 7 (after the User model exists). This baseline exists so subsequent autogenerate diffs are clean.

---

# Phase 1 — User Model & Auth

### Task 3: User model

**Files:**
- Create: `backend/app/auth/__init__.py`, `backend/app/auth/models.py`
- Modify: `backend/app/models.py` (import User so Alembic sees it)
- Test: `backend/tests/test_user_model.py`

**Interfaces:**
- Produces: `app.auth.models.User` — SQLAlchemy model with columns `id: UUID`, `email`, `hashed_password`, `is_active`, `is_verified`, `is_superuser`, `created_at`, `lichess_username: str | None`, `chesscom_username: str | None`.

- [ ] **Step 1: Write failing test** `backend/tests/test_user_model.py`:
```python
from app.auth.models import User

def test_user_has_platform_username_columns():
    cols = User.__table__.columns.keys()
    assert "lichess_username" in cols
    assert "chesscom_username" in cols
    assert "is_verified" in cols
```

- [ ] **Step 2: Create `backend/app/auth/models.py`:**
```python
import uuid
from datetime import datetime
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base

class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    lichess_username: Mapped[str | None] = mapped_column(String, nullable=True)
    chesscom_username: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```
`SQLAlchemyBaseUserTableUUID` provides `id` (UUID), `email`, `hashed_password`, `is_active`, `is_superuser`, `is_verified`.

- [ ] **Step 3:** In `backend/app/models.py`, add at top: `from .auth.models import User  # noqa: F401`.

- [ ] **Step 4: Run** `pytest tests/test_user_model.py -v` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: add User model with linked platform usernames"`.

---

### Task 4: FastAPI-Users manager, DB adapter, cookie auth backend

**Files:**
- Create: `backend/app/auth/users.py`, `backend/app/auth/schemas.py`, `backend/app/auth/deps.py`
- Test: `backend/tests/test_auth_flow.py`

**Interfaces:**
- Produces:
  - `app.auth.deps.current_active_user` — FastAPI dependency → `User` (401 if not logged in).
  - `app.auth.deps.current_verified_user` — dependency → verified `User` (403 if unverified).
  - `app.auth.users.fastapi_users` — the `FastAPIUsers` instance (used to build routers in Task 6).
  - `app.auth.users.auth_backend` — cookie+JWT backend.
  - `app.auth.schemas.UserRead/UserCreate/UserUpdate`.

- [ ] **Step 1: Create `backend/app/auth/schemas.py`:**
```python
import uuid
from fastapi_users import schemas

class UserRead(schemas.BaseUser[uuid.UUID]):
    lichess_username: str | None = None
    chesscom_username: str | None = None

class UserCreate(schemas.BaseUserCreate):
    pass

class UserUpdate(schemas.BaseUserUpdate):
    lichess_username: str | None = None
    chesscom_username: str | None = None
```

- [ ] **Step 2: Create `backend/app/auth/users.py`:**
```python
import uuid
from fastapi_users import FastAPIUsers, BaseUserManager, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend, CookieTransport, JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi import Depends
from ..config import settings
from ..database import get_db
from .models import User
from ..services.email_service import send_verification_email, send_reset_email

async def get_user_db(db=Depends(get_db)):
    yield SQLAlchemyUserDatabase(db, User)

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.secret_key
    verification_token_secret = settings.secret_key

    async def on_after_register(self, user, request=None):
        await self.request_verify(user, request)

    async def on_after_request_verify(self, user, token, request=None):
        send_verification_email(user.email, token)

    async def on_after_forgot_password(self, user, token, request=None):
        send_reset_email(user.email, token)

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

cookie_transport = CookieTransport(
    cookie_max_age=settings.access_token_lifetime,
    cookie_secure=settings.cookie_secure,
    cookie_samesite=settings.cookie_samesite,
    cookie_httponly=True,
)

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.secret_key, lifetime_seconds=settings.access_token_lifetime)

auth_backend = AuthenticationBackend(
    name="cookie", transport=cookie_transport, get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])
```
> Note: `get_db` is sync; FastAPI-Users supports sync sessions via `SQLAlchemyUserDatabase`. Keep the sync session to match the rest of the app.

- [ ] **Step 3: Create `backend/app/auth/deps.py`:**
```python
from fastapi import Depends, HTTPException, status
from .users import fastapi_users
from .models import User

current_active_user = fastapi_users.current_user(active=True)

def current_verified_user(user: User = Depends(current_active_user)) -> User:
    if not user.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email not verified")
    return user
```

- [ ] **Step 4: Write failing test** `backend/tests/test_auth_flow.py` (uses FastAPI `TestClient`; assumes Task 6 wires routers — so this test is RED until Task 6, which is acceptable; mark it `@pytest.mark.order(after=...)` or simply expect it RED here and GREEN after Task 6). Minimal smoke for now:
```python
from app.auth.users import fastapi_users, auth_backend
def test_auth_objects_exist():
    assert auth_backend.name == "cookie"
    assert fastapi_users is not None
```

- [ ] **Step 5: Run** `pytest tests/test_auth_flow.py -v` → PASS. (Email service stubs come in Task 5; if import fails, do Task 5 first — they are co-dependent; implement Task 5 Step 1-2 before running.)

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: FastAPI-Users manager + cookie JWT auth backend"`.

---

### Task 5: Email service (Resend)

**Files:**
- Create: `backend/app/services/email_service.py`
- Test: `backend/tests/test_email_service.py`

**Interfaces:**
- Produces: `send_verification_email(email: str, token: str) -> None`, `send_reset_email(email: str, token: str) -> None`. Both build a frontend URL and send via Resend; no-op + log if `resend_api_key` is empty (dev).

- [ ] **Step 1: Write failing test** `backend/tests/test_email_service.py`:
```python
from unittest.mock import patch
from app.services import email_service

def test_verification_email_builds_frontend_link(monkeypatch):
    monkeypatch.setattr(email_service.settings, "resend_api_key", "test")
    monkeypatch.setattr(email_service.settings, "frontend_url", "https://app.test")
    with patch.object(email_service, "_send") as m:
        email_service.send_verification_email("u@test.com", "TOK")
    body = m.call_args.kwargs["html"] if m.call_args.kwargs else m.call_args.args[2]
    assert "https://app.test/verify-email?token=TOK" in body

def test_no_api_key_is_noop(monkeypatch):
    monkeypatch.setattr(email_service.settings, "resend_api_key", "")
    email_service.send_verification_email("u@test.com", "TOK")  # must not raise
```

- [ ] **Step 2: Implement `backend/app/services/email_service.py`:**
```python
import logging
from ..config import settings

logger = logging.getLogger(__name__)

def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("Email skipped (no RESEND_API_KEY): %s -> %s", subject, to)
        return
    import resend
    resend.api_key = settings.resend_api_key
    resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    _send(email, "Verify your ChessMaster email",
          f'<p>Confirm your email:</p><p><a href="{link}">{link}</a></p>')

def send_reset_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    _send(email, "Reset your ChessMaster password",
          f'<p>Reset your password:</p><p><a href="{link}">{link}</a></p>')
```

- [ ] **Step 3: Run** `pytest tests/test_email_service.py -v` → PASS.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: Resend email service for verification + reset"`.

---

### Task 6: Wire auth routers + `/me` with linked usernames

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_auth_endpoints.py`, `backend/tests/conftest.py`

**Interfaces:**
- Produces HTTP routes under `/api/auth`: `register`, `login`, `logout`, `verify`/`request-verify-token`, `forgot-password`, `reset-password`, and `/api/users/me` (GET/PATCH, returns/sets `lichess_username`, `chesscom_username`).
- Produces test fixtures: `client` (TestClient), `verified_user_client` (logged-in, verified cookie set).

- [ ] **Step 1: Wire routers** in `backend/app/main.py`:
```python
from .auth.users import fastapi_users, auth_backend
from .auth.schemas import UserRead, UserCreate, UserUpdate

app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_verify_router(UserRead), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_reset_password_router(), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/api/users", tags=["users"])
```

- [ ] **Step 2: Create `backend/tests/conftest.py`** with fixtures (override `get_db` to a transactional test session, build verified user, log in to capture cookie). Provide:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.auth.models import User

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def verified_user_client(client):
    client.post("/api/auth/register", json={"email": "a@test.com", "password": "pw12345678"})
    db = SessionLocal()
    u = db.query(User).filter(User.email == "a@test.com").first()
    u.is_verified = True
    db.commit(); db.close()
    client.post("/api/auth/login", data={"username": "a@test.com", "password": "pw12345678"})
    return client
```
> Clean the `users`/data tables between tests (truncate in an autouse fixture) since the DB is shared.

- [ ] **Step 3: Write failing test** `backend/tests/test_auth_endpoints.py`:
```python
def test_register_then_login_sets_cookie(client):
    r = client.post("/api/auth/register", json={"email": "b@test.com", "password": "pw12345678"})
    assert r.status_code == 201
    # before verify, login still issues a cookie (verification gates DATA, not login)
    r = client.post("/api/auth/login", data={"username": "b@test.com", "password": "pw12345678"})
    assert r.status_code == 204
    assert "chessmasterauth" in r.cookies or any("cookie" in k.lower() for k in r.headers)

def test_patch_me_sets_usernames(verified_user_client):
    r = verified_user_client.patch("/api/users/me",
        json={"lichess_username": "magnus", "chesscom_username": "hikaru"})
    assert r.status_code == 200
    assert r.json()["lichess_username"] == "magnus"
```

- [ ] **Step 4: Run** `pytest tests/test_auth_endpoints.py -v` → iterate until PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: wire auth + users routers, /me linked usernames"`.

---

# Phase 2 — Multi-Tenancy Scoping

### Task 7: Add `user_id` to data models + Game identity fix + migration

**Files:**
- Modify: `backend/app/models.py`
- Create: migration in `backend/alembic/versions/`
- Test: `backend/tests/test_models_user_scoping.py`

**Interfaces:**
- Produces: `Game`, `AnalysisJob`, `Report`, `PuzzleProgress`, `SyncState` all gain `user_id: UUID` (FK `users.id`, indexed, `nullable=False`). `Game` PK becomes surrogate UUID string with `UniqueConstraint(user_id, platform, platform_id)`. `SyncState` PK becomes `(user_id, platform)`.

- [ ] **Step 1: Write failing test** `backend/tests/test_models_user_scoping.py`:
```python
from app.models import Game, AnalysisJob, Report, PuzzleProgress, SyncState

def test_all_data_tables_have_user_id():
    for m in (Game, AnalysisJob, Report, PuzzleProgress, SyncState):
        assert "user_id" in m.__table__.columns.keys(), m.__name__

def test_game_unique_per_user_platform():
    names = {tuple(c.name for c in uc.columns) for uc in Game.__table__.constraints
             if hasattr(uc, "columns")}
    assert any({"user_id", "platform", "platform_id"} <= set(n) for n in names)
```

- [ ] **Step 2: Edit `backend/app/models.py`.** Add `from sqlalchemy import ForeignKey` and to each model add:
```python
user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
```
For `Game`: change `id` default to a UUID surrogate and replace the unique constraint:
```python
# id stays String PK but now holds a UUID; platform/platform_id stay columns
__table_args__ = (
    UniqueConstraint("user_id", "platform", "platform_id"),
    Index("idx_games_user_played_at", "user_id", "played_at"),
    Index("idx_games_opening", "opening_eco"),
    Index("idx_games_time_class", "time_class"),
)
```
For `SyncState`: drop `platform` as sole PK; make composite:
```python
user_id = Column(String, ForeignKey("users.id"), primary_key=True)
platform = Column(String, primary_key=True)
```
> Use `String` for `user_id` to match FastAPI-Users UUID stored as string-compatible; if using native Postgres UUID, import `from sqlalchemy.dialects.postgresql import UUID` and use `UUID(as_uuid=True)` consistently with `users.id`. Pick ONE and use it everywhere.

- [ ] **Step 3: Generate migration** `alembic revision --autogenerate -m "add users table + user_id scoping"`. Inspect it (autogenerate may miss the Game PK change — hand-edit to drop/recreate constraints). `alembic upgrade head`.

- [ ] **Step 4: Run** `pytest tests/test_models_user_scoping.py -v` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: add user_id scoping to all data tables + Game identity fix"`.

---

### Task 8: Establish the scoping pattern on the `games` router

**Files:**
- Modify: `backend/app/routers/games.py`
- Test: `backend/tests/test_games_isolation.py`

**Interfaces:**
- Produces the canonical scoping pattern every other router copies:
  1. `from ..auth.deps import current_verified_user` and `from ..auth.models import User`.
  2. Add `user: User = Depends(current_verified_user)` to every endpoint.
  3. Add `.filter(Model.user_id == user.id)` to every `Game`/`AnalysisJob`/`MoveAnalysis` query. For `MoveAnalysis` (no direct `user_id`), scope via its game: filter `MoveAnalysis.game_id.in_(<user's game ids>)` or join `Game`.

- [ ] **Step 1: Write failing test** `backend/tests/test_games_isolation.py`:
```python
def test_user_only_sees_own_games(verified_user_client, make_game_for):
    # make_game_for(email) seeds one game owned by that user (fixture in conftest)
    make_game_for("a@test.com")   # current user
    make_game_for("other@test.com")
    r = verified_user_client.get("/api/games")
    assert r.status_code == 200
    assert len(r.json()) == 1

def test_games_requires_auth(client):
    assert client.get("/api/games").status_code == 401
```
Add `make_game_for` fixture to `conftest.py` that inserts a `Game` with the given user's id.

- [ ] **Step 2: Edit `games.py`** — add the import + `Depends(current_verified_user)` to `list_games` and `get_game`; add `.filter(Game.user_id == user.id)` to the `Game` query; scope the `AnalysisJob` query with `.filter(AnalysisJob.user_id == user.id)`; in `get_game`, 404 if the game's `user_id != user.id`.

- [ ] **Step 3: Run** `pytest tests/test_games_isolation.py -v` → PASS.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: scope games router to current user (pattern reference)"`.

---

### Task 9: Apply the scoping pattern to all remaining read routers

**Files (modify each, one commit per file):**
- `routers/stats.py`, `patterns.py`, `openings.py`, `report.py`, `puzzles.py`, `tilt.py`, `time_management.py`, `endgame.py`, `rating_predictor.py`, `digest.py`, `peer_comparison.py`, `export.py`, `opening_book.py`, `scouting.py`
- Test: `backend/tests/test_router_isolation.py` (parametrized over endpoints)

**Interfaces:**
- Consumes: the Task 8 pattern (`current_verified_user`, `.filter(Model.user_id == user.id)`).
- Produces: every data endpoint requires auth (401 without) and returns only the user's rows.

> This is mechanical repetition of Task 8's pattern. For EACH file: add the two imports, add `user: User = Depends(current_verified_user)` to every route handler, and add `.filter(... .user_id == user.id)` to every `Game`/`MoveAnalysis`/`AnalysisJob`/`Report`/`PuzzleProgress` query. Where a router delegates to a service, thread `user.id` into the service call (see Task 10/11 for service signatures). For `report.py` and any module-global status dict, see Task 13.

- [ ] **Step 1: Write parametrized failing test** `backend/tests/test_router_isolation.py`:
```python
import pytest
GET_ENDPOINTS = [
    "/api/stats/overview", "/api/patterns", "/api/openings/tree",
    "/api/time-management", "/api/tilt", "/api/endgame",
    "/api/rating-predictor", "/api/digest", "/api/peer-comparison",
    "/api/puzzles/stats", "/api/export/summary",
]
@pytest.mark.parametrize("ep", GET_ENDPOINTS)
def test_requires_auth(client, ep):
    assert client.get(ep).status_code == 401
```

- [ ] **Step 2:** Run → it will FAIL for any unscoped endpoint (returns 200). Fix files one at a time, committing per file: `git commit -m "feat: scope <name> router to current user"`.

- [ ] **Step 3:** Re-run until all parametrized cases PASS.

- [ ] **Step 4: Add an isolation test** for at least `stats` and `puzzles` proving two users get different data (seed one game/puzzle each, assert counts), mirroring Task 8.

- [ ] **Step 5: Final commit** for the test file `git add backend/tests/test_router_isolation.py && git commit -m "test: cross-router auth + isolation coverage"`.

---

### Task 10: Per-user sync (stored usernames, per-user status)

**Files:**
- Modify: `backend/app/routers/sync.py`, `backend/app/services/sync_service.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_sync_scoping.py`

**Interfaces:**
- Produces:
  - `POST /api/sync` takes NO body; reads `user.lichess_username` / `user.chesscom_username`; 400 if both empty.
  - `SyncService.sync_all(user_id: str, lichess_username: str | None, chesscom_username: str | None, status: dict) -> int`.
  - `_insert_games` stamps `user_id` and a UUID `Game.id`; uniqueness check by `(user_id, platform, platform_id)`.
  - Per-user status: `_sync_status: dict[str, dict]` keyed by `user_id`; `GET /api/sync/status` returns the caller's entry.

- [ ] **Step 1: Write failing test** `backend/tests/test_sync_scoping.py`:
```python
def test_sync_requires_a_linked_username(verified_user_client):
    r = verified_user_client.post("/api/sync")
    assert r.status_code == 400

def test_sync_uses_stored_usernames(verified_user_client, monkeypatch):
    verified_user_client.patch("/api/users/me", json={"lichess_username": "magnus"})
    # monkeypatch LichessClient.fetch_games to return [] ; assert 200 + status keyed per user
    r = verified_user_client.post("/api/sync")
    assert r.status_code == 200
```

- [ ] **Step 2: Edit `sync_service.py`** — new signature, per-platform username, stamp `user_id`, UUID ids:
```python
import uuid
async def sync_all(self, user_id, lichess_username, chesscom_username, status):
    db = SessionLocal()
    try:
        total = 0
        if chesscom_username:
            games = await self.chesscom.fetch_games(chesscom_username)
            total += self._insert_games(db, user_id, games)
        if lichess_username:
            games = await self.lichess.fetch_games(lichess_username)
            total += self._insert_games(db, user_id, games)
        for platform in ("chesscom", "lichess"):
            state = db.query(SyncState).filter_by(user_id=user_id, platform=platform).first()
            if not state:
                state = SyncState(user_id=user_id, platform=platform); db.add(state)
            state.last_synced_at = datetime.utcnow()
        db.commit()
        return total
    finally:
        db.close()

def _insert_games(self, db, user_id, games):
    inserted = 0
    for g in games:
        exists = db.query(Game).filter_by(
            user_id=user_id, platform=g["platform"], platform_id=g["platform_id"]).first()
        if exists: continue
        db.add(Game(id=str(uuid.uuid4()), user_id=user_id, **g))
        inserted += 1
    db.commit()
    return inserted
```

- [ ] **Step 3: Edit `sync.py`** — drop `SyncRequest`; per-user status dict; read usernames:
```python
_sync_status: dict[str, dict] = {}

@router.post("/sync")
async def start_sync(user: User = Depends(current_verified_user)):
    if not (user.lichess_username or user.chesscom_username):
        raise HTTPException(400, "Link a Lichess or Chess.com username first")
    if _sync_status.get(str(user.id), {}).get("status") == "syncing":
        return {"message": "Sync already in progress"}
    asyncio.ensure_future(_run_sync(str(user.id), user.lichess_username, user.chesscom_username))
    return {"message": "Sync started"}

@router.get("/sync/status", response_model=SyncStatus)
def get_sync_status(user: User = Depends(current_verified_user)):
    return SyncStatus(**_sync_status.get(str(user.id), {"status": "idle", "games_fetched": 0, "message": ""}))
```
Update `_run_sync` to accept `(user_id, lichess, chesscom)` and write into `_sync_status[user_id]`.

- [ ] **Step 4:** Remove `SyncRequest` from `schemas.py` (and its `username`).

- [ ] **Step 5: Run** `pytest tests/test_sync_scoping.py -v` → PASS.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: per-user sync from stored usernames + per-user status"`.

---

### Task 11: Scope PGN import to current user

**Files:**
- Modify: `backend/app/routers/pgn_import.py`, `backend/app/services/pgn_import.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_pgn_import_scoping.py`

**Interfaces:**
- Produces: import endpoints take no body `username`; games inserted with `user.id` and UUID ids; the player username for color detection comes from `user.lichess_username`/`chesscom_username` (or PGN headers). Import service signature gains `user_id` and the resolved username.

- [ ] **Step 1:** Read `backend/app/services/pgn_import.py` and `routers/pgn_import.py` to find the current username param.
- [ ] **Step 2: Write failing test** asserting import requires auth (401 unauthenticated) and inserted games carry `user_id`.
- [ ] **Step 3:** Add `Depends(current_verified_user)`; thread `user.id` + resolved username into the service; stamp `user_id` + UUID `Game.id`; dedupe by `(user_id, platform, platform_id)`.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: scope PGN import to current user"`.

---

### Task 12: Scope scouting (external opponent fetch)

**Files:**
- Modify: `backend/app/routers/scouting.py`
- Test: `backend/tests/test_scouting_auth.py`

**Interfaces:**
- Produces: `/api/scouting/scout` requires auth. Scouting fetches an *opponent's* public games (not user-owned), so no `user_id` scoping of results — but cross-references against the *current user's* games must filter by `user.id`.

- [ ] **Step 1:** Write failing test: unauthenticated `POST /api/scouting/scout` → 401.
- [ ] **Step 2:** Add `Depends(current_verified_user)`; any query over the user's own games for cross-reference gets `.filter(Game.user_id == user.id)`.
- [ ] **Step 3: Run** → PASS. **Commit** `git commit -m "feat: require auth for scouting + scope cross-references"`.

---

### Task 13: Scope `report` router + per-user generation status

**Files:**
- Modify: `backend/app/routers/report.py`
- Test: `backend/tests/test_report_scoping.py`

**Interfaces:**
- Produces: report generation reads only the user's games/analyses; stored `Report` rows carry `user_id`; `report/latest` returns the user's latest; module-global status becomes per-user (`dict[str, dict]` keyed by `user_id`), mirroring Task 10.

- [ ] **Step 1:** Write failing test: unauthenticated 401; two users get separate latest reports.
- [ ] **Step 2:** Apply scoping + per-user status dict; thread `user.id` into `report_generator`.
- [ ] **Step 3: Run** → PASS. **Commit** `git commit -m "feat: scope report generation + per-user status"`.

---

# Phase 3 — Client-Side Stockfish Analysis

### Task 14: Server endpoints — `analyze/pending` + `analyze/results`

**Files:**
- Modify: `backend/app/routers/analysis.py`, `backend/app/schemas.py`
- Create: `backend/app/services/analysis_ingest.py`
- Test: `backend/tests/test_analysis_ingest.py`

**Interfaces:**
- Produces:
  - `GET /api/analyze/pending` → `list[{game_id: str, pgn: str}]` for the user's games without a completed `AnalysisJob`.
  - `POST /api/analyze/results` body `AnalyzeResultsIn`:
    ```python
    class MoveEval(BaseModel):
        move_number: int; is_player_move: int
        fen_before: str; move_uci: str; move_san: str
        eval_before: float | None; eval_after: float | None
        best_move_uci: str | None
    class AnalyzeResultsIn(BaseModel):
        game_id: str; depth: int; moves: list[MoveEval]
    ```
  - `analysis_ingest.store_results(db, user_id, payload) -> None` — verifies game ownership (404 else), deletes existing `MoveAnalysis` for the game, then for each move: computes `centipawn_loss = max(0, eval_before - eval_after)` for player moves, calls existing `classify_move(...)` and (when player move + cpl>50 + best move) `detect_tactical_motifs(chess.Board(fen_before), chess.Move.from_uci(best_move_uci))`, resolves `best_move_san`, writes `MoveAnalysis`, and upserts `AnalysisJob(status="completed", user_id=user_id)`.

- [ ] **Step 1: Write failing test** `backend/tests/test_analysis_ingest.py`:
```python
def test_store_results_classifies_and_marks_complete(db_session, seeded_user_game):
    from app.services.analysis_ingest import store_results
    payload = AnalyzeResultsIn(game_id=seeded_user_game.id, depth=12, moves=[
        MoveEval(move_number=0, is_player_move=1, fen_before=START_FEN,
                 move_uci="e2e4", move_san="e4", eval_before=20, eval_after=15,
                 best_move_uci="e2e4")])
    store_results(db_session, seeded_user_game.user_id, payload)
    rows = db_session.query(MoveAnalysis).filter_by(game_id=seeded_user_game.id).all()
    assert len(rows) == 1 and rows[0].classification  # non-empty
    job = db_session.query(AnalysisJob).filter_by(game_id=seeded_user_game.id).first()
    assert job.status == "completed"

def test_store_results_rejects_other_users_game(db_session, seeded_user_game):
    import pytest; from fastapi import HTTPException
    with pytest.raises(HTTPException):
        store_results(db_session, "00000000-0000-0000-0000-000000000000",
                      AnalyzeResultsIn(game_id=seeded_user_game.id, depth=12, moves=[]))
```

- [ ] **Step 2: Implement `analysis_ingest.py`** porting the cheap half of `stockfish_analyzer._analyze_game` (everything except `engine.analyse`). Reuse `classify_move`, `detect_tactical_motifs`, `get_game_phase`, and clock extraction from the stored PGN (`extract_clocks`).

- [ ] **Step 3: Rewrite `analysis.py`** — drop the engine task; add the two endpoints, both `Depends(current_verified_user)`:
```python
@router.get("/analyze/pending")
def pending(user=Depends(current_verified_user), db=Depends(get_db)):
    done = {r.game_id for r in db.query(AnalysisJob.game_id)
            .filter(AnalysisJob.user_id == user.id, AnalysisJob.status == "completed")}
    games = db.query(Game).filter(Game.user_id == user.id).all()
    return [{"game_id": g.id, "pgn": g.pgn} for g in games if g.id not in done]

@router.post("/analyze/results")
def results(payload: AnalyzeResultsIn, user=Depends(current_verified_user), db=Depends(get_db)):
    store_results(db, str(user.id), payload)
    return {"status": "ok"}
```
Keep `GET /analyze/status` returning counts derived from `AnalysisJob` for the user (or remove if the client tracks progress; keep a lightweight count endpoint).

- [ ] **Step 4: Delete** `backend/app/services/stockfish_analyzer.py` and its import. Add a guard test that no request-path module imports `chess.engine`:
```python
def test_no_engine_import_in_routers():
    import pathlib
    src = pathlib.Path("app").rglob("*.py")
    offenders = [p for p in src if "chess.engine" in p.read_text() and "stockfish_analyzer" not in p.name]
    assert not offenders
```

- [ ] **Step 5: Run** `pytest tests/test_analysis_ingest.py -v` → PASS.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: client-side analysis ingest endpoints, retire server engine"`.

---

### Task 15: Frontend Stockfish WASM worker wrapper

**Files:**
- Create: `frontend/public/stockfish/` (WASM assets), `frontend/src/lib/engine.ts`
- Test: `frontend/src/__tests__/engine.test.ts` (mock Worker)

**Interfaces:**
- Produces: `class Engine { init(): Promise<void>; analyse(fen: string, depth: number): Promise<{scoreCp: number | null; bestMoveUci: string | null}>; quit(): void }`. `scoreCp` is from White's perspective in centipawns; mate scores map to ±10000.

- [ ] **Step 1: Add assets.** Install `stockfish` npm package or download `stockfish.wasm` + loader into `frontend/public/stockfish/`. Document the exact file names in a `README` there.

- [ ] **Step 2: Write failing test** `frontend/src/__tests__/engine.test.ts` mocking a Worker that replies with a canned `info depth N score cp 34 ... bestmove e2e4` and asserting `analyse` resolves `{scoreCp: 34, bestMoveUci: "e2e4"}`.

- [ ] **Step 3: Implement `engine.ts`** — spawn a `Worker` for `stockfish.js`, send UCI commands (`uci`, `isready`, `position fen <fen>`, `go depth <depth>`), parse `info ... score cp|mate ...` and `bestmove`, resolve per-`go`. Map `score mate k` → `10000 * sign(k)`.

- [ ] **Step 4: Run** `npm test -- engine` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: frontend Stockfish WASM engine wrapper"`.

---

### Task 16: Frontend client analysis loop

**Files:**
- Create: `frontend/src/lib/analyze.ts`
- Modify: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, the analysis UI page/component that calls `startAnalysis`
- Test: `frontend/src/__tests__/analyze.test.ts`

**Interfaces:**
- Consumes: `Engine` (Task 15), `api.getPending()`, `api.postAnalysisResults(payload)` (Task 17 adds these to `api.ts`).
- Produces: `runAnalysis(onProgress: (done: number, total: number) => void): Promise<void>` — fetches pending games, for each: walk PGN with `chess.js`, eval each position once (carry-forward like the server did), build `MoveEval[]`, POST results, report progress.

- [ ] **Step 1: Write failing test** mocking `Engine.analyse` + `api` to assert one pending game produces one `postAnalysisResults` call with the right move count.
- [ ] **Step 2: Implement `analyze.ts`** mirroring the server's old carry-forward eval (eval start once; after each push, eval new position = next `eval_before`); compute `move_san`/`move_uci` from `chess.js`; mark `is_player_move` from player color (derive from game record — add `player_color` to the pending payload OR infer from PGN headers vs linked username; simplest: include `player_color` in `/analyze/pending` response).
> Update Task 14 `/analyze/pending` to also return `player_color` so the client can set `is_player_move`. Add it now if not present.
- [ ] **Step 3: Run** `npm test -- analyze` → PASS.
- [ ] **Step 4: Wire the UI** — the existing "Analyze" button calls `runAnalysis` with a progress callback instead of polling the server. Commit `git commit -m "feat: browser-driven analysis loop"`.

---

# Phase 4 — Frontend Auth & Settings

### Task 17: API client — cookie credentials, 401 handling, new endpoints

**Files:**
- Modify: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`
- Test: `frontend/src/__tests__/api.test.ts`

**Interfaces:**
- Produces: `fetchAPI` sends `credentials: "include"`; on 401 throws a typed `AuthError`. New methods: `register`, `login`, `logout`, `getMe`, `updateMe`, `requestVerify`, `verifyEmail`, `forgotPassword`, `resetPassword`, `getPending`, `postAnalysisResults`. `startSync()` and `importPgnText(pgn)` lose their `username` args.

- [ ] **Step 1: Update existing failing test** `api.test.ts` to assert `credentials: "include"` is passed and `startSync` no longer sends a username.
- [ ] **Step 2: Implement** — add `credentials: "include"` to `fetchAPI`; add an `AuthError` thrown on `res.status === 401`; add the new methods (form-encoded body for `login` per FastAPI-Users: `username`/`password`); remove `username` params from `startSync`/`importPgnText`.
- [ ] **Step 3: Run** `npm test -- api` → PASS. **Commit** `git commit -m "feat: cookie-auth API client + auth/analysis endpoints"`.

---

### Task 18: Auth context/provider + route guard

**Files:**
- Create: `frontend/src/lib/auth.tsx`, `frontend/src/components/AuthGuard.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Test: `frontend/src/__tests__/auth.test.tsx`

**Interfaces:**
- Produces: `AuthProvider` (fetches `/users/me` on mount), `useAuth() → {user, loading, login, logout, refresh}`. `AuthGuard` redirects unauthenticated users to `/login`, and unverified users to a "verify your email" notice; renders children only for verified users.

- [ ] **Step 1: Write failing test** rendering `AuthGuard` with a mocked `useAuth` returning `user=null` → asserts redirect to `/login`; `user.is_verified=false` → asserts verify notice.
- [ ] **Step 2: Implement** `auth.tsx` + `AuthGuard.tsx`; wrap the app in `layout.tsx` with `<AuthProvider>` and gate the dashboard routes with `<AuthGuard>` (keep `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` public).
- [ ] **Step 3: Run** `npm test -- auth` → PASS. **Commit** `git commit -m "feat: auth provider + route guard"`.

---

### Task 19: Auth pages

**Files:**
- Create: `frontend/src/app/{login,register,verify-email,forgot-password,reset-password}/page.tsx`
- Test: `frontend/src/__tests__/login.test.tsx`

**Interfaces:**
- Consumes: `useAuth().login`, `api.register/forgotPassword/resetPassword/verifyEmail`.
- Produces: working forms. `/login` (email+password → `login` → redirect home). `/register` (creates account → "check your email" notice). `/verify-email` (reads `?token=` → `api.verifyEmail(token)` → success/error). `/forgot-password` (email → request). `/reset-password` (reads `?token=`, new password → reset → redirect login).

- [ ] **Step 1: Write failing test** for `/login`: fills form, submits, asserts `login` called with the entered creds and redirect on success.
- [ ] **Step 2: Implement** the five pages (match existing Tailwind styling; reuse simple form components). Token pages read `useSearchParams()`.
- [ ] **Step 3: Run** `npm test -- login` → PASS. **Commit** `git commit -m "feat: login/register/verify/reset pages"`.

---

### Task 20: Settings page (linked usernames) + sync UI update + user chrome

**Files:**
- Create: `frontend/src/app/settings/page.tsx`
- Modify: sync UI component, `frontend/src/components/Sidebar.tsx` and/or `StatusBar.tsx`
- Test: `frontend/src/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes: `api.getMe`, `api.updateMe`, `useAuth().logout`.
- Produces: `/settings` form to set/clear `lichess_username` + `chesscom_username` (calls `updateMe`); the Sync UI drops its username input and reads linked usernames (prompts the user to visit `/settings` if none linked); sidebar/status shows the logged-in email + a Logout button.

- [ ] **Step 1: Write failing test** for `/settings`: renders current usernames from a mocked `getMe`, edits one, submits, asserts `updateMe` called with the new value.
- [ ] **Step 2: Implement** the settings page; remove the username input from the sync flow; add logout + user display to the app chrome.
- [ ] **Step 3: Run** `npm test -- settings` → PASS. **Commit** `git commit -m "feat: settings page, sync UI uses linked usernames, logout"`.

---

### Task 21: End-to-end smoke + docs

**Files:**
- Modify: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `frontend/.env.production`, `backend/.env.example`
- Test: manual checklist

- [ ] **Step 1:** Update docs: new auth flow, Postgres + `docker compose up -d db`, Alembic (`alembic upgrade head`), client-side analysis, env vars (`SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `DATABASE_URL`).
- [ ] **Step 2: Manual smoke** (document results): register → receive/inspect verify link (dev logs) → verify → login → set usernames in `/settings` → sync → run browser analysis → view games/stats scoped to the account → register a 2nd user and confirm data isolation.
- [ ] **Step 3:** Run full suites: `cd backend && pytest` and `cd frontend && npm test` → all PASS.
- [ ] **Step 4: Commit** `git add -A && git commit -m "docs: multi-user SaaS setup + auth/analysis flows"`.

---

## Self-Review Notes

- **Spec coverage:** Postgres+Alembic (T1–2), User model + linked usernames (T3, T6), FastAPI-Users auth + verification/reset + cookies (T4–6), email provider (T5), `user_id` on all tables + Game identity fix (T7), full query scoping incl. sync/import/scouting/report (T8–13), client-side WASM analysis with server classification retained (T14–16), frontend auth/guard/pages/settings + sync UI change (T17–20), tenant-isolation tests throughout, docs (T21). All spec sections mapped.
- **Verification gate:** implemented as "login allowed, data endpoints require `current_verified_user` (403 if unverified)" per spec decision — `current_verified_user` is the dependency used on all data routers; `AuthGuard` shows the verify notice in the UI.
- **Type consistency:** `current_verified_user`, `auth_backend`, `fastapi_users`, `store_results`, `AnalyzeResultsIn`/`MoveEval`, `Engine.analyse`, `runAnalysis` used consistently across tasks. Decide UUID-as-string vs native UUID once in Task 7 and keep it everywhere `user_id` is declared.
- **Known co-dependency:** Tasks 4 and 5 import each other's symbols — implement Task 5 (`email_service`) before running Task 4's test (noted in Task 4 Step 5).
