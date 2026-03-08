from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import analysis, games, openings, patterns, puzzles, report, stats, sync, time_management


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
app.include_router(time_management.router, prefix="/api")


@app.get("/api/health")
def health():
    sf = settings.resolve_stockfish()
    return {
        "status": "ok",
        "stockfish_available": sf is not None,
        "stockfish_path": sf,
    }
