import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import analysis, digest, endgame, export, games, opening_book, openings, patterns, peer_comparison, pgn_import, puzzles, rating_predictor, report, scouting, stats, sync, tilt, time_management
from .auth.users import fastapi_users, auth_backend
from .auth.schemas import UserRead, UserCreate, UserUpdate

logger = logging.getLogger(__name__)

_INSECURE_DEFAULT_KEY = "CHANGE_ME_DEV_ONLY"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations — no create_all here
    if settings.secret_key == _INSECURE_DEFAULT_KEY:
        logger.warning(
            "SECURITY: SECRET_KEY is the insecure dev default — "
            "set SECRET_KEY in the environment for any non-local deployment."
        )
    elif not settings.cookie_secure:
        logger.warning(
            "SECURITY: COOKIE_SECURE is False but SECRET_KEY has been changed — "
            "set COOKIE_SECURE=true for any non-local deployment."
        )
    yield


app = FastAPI(title="ChessMaster", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync.router, prefix="/api")
app.include_router(games.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(patterns.router, prefix="/api")
app.include_router(openings.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(puzzles.router, prefix="/api")
app.include_router(tilt.router, prefix="/api")
app.include_router(time_management.router, prefix="/api")
app.include_router(scouting.router, prefix="/api")
app.include_router(endgame.router, prefix="/api")
app.include_router(rating_predictor.router, prefix="/api")
app.include_router(digest.router, prefix="/api")
app.include_router(peer_comparison.router, prefix="/api")
app.include_router(pgn_import.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(opening_book.router, prefix="/api")

# Auth routers
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_verify_router(UserRead), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_reset_password_router(), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/api/users", tags=["users"])


@app.get("/api/health")
def health():
    sf = settings.resolve_stockfish()
    return {
        "status": "ok",
        "stockfish_available": sf is not None,
        "stockfish_path": sf,
    }
