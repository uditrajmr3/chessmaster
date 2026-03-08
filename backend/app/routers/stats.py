from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Game
from ..schemas import OverviewStats, RatingEstimate

router = APIRouter(tags=["stats"])

# Approximate FIDE conversion offsets by platform and time class.
# These are rough community-consensus estimates for players in the 800-1500 range.
FIDE_OFFSETS: dict[tuple[str, str], int] = {
    ("chesscom", "rapid"): -150,
    ("chesscom", "classical"): -100,
    ("chesscom", "blitz"): -200,
    ("chesscom", "bullet"): -250,
    ("chesscom", "daily"): -100,
    ("lichess", "rapid"): -250,
    ("lichess", "classical"): -200,
    ("lichess", "blitz"): -250,
    ("lichess", "bullet"): -300,
    ("lichess", "correspondence"): -200,
}


@router.get("/stats/overview", response_model=OverviewStats)
def get_overview(db: Session = Depends(get_db)):
    games = db.query(Game).all()
    total = len(games)
    wins = sum(1 for g in games if g.result == "win")
    losses = sum(1 for g in games if g.result == "loss")
    draws = sum(1 for g in games if g.result == "draw")

    platforms: dict[str, int] = {}
    accuracies = []
    rating_history: list[dict] = []

    # Track latest rating per (platform, time_class)
    latest_ratings: dict[tuple[str, str], tuple[int, str]] = {}

    for g in sorted(games, key=lambda x: x.played_at):
        platforms[g.platform] = platforms.get(g.platform, 0) + 1
        if g.platform_accuracy:
            accuracies.append(g.platform_accuracy)
        rating_history.append({
            "date": g.played_at.isoformat(),
            "rating": g.player_rating,
            "platform": g.platform,
            "time_class": g.time_class,
        })
        key = (g.platform, g.time_class)
        latest_ratings[key] = (g.player_rating, g.played_at.isoformat())

    avg_acc = sum(accuracies) / len(accuracies) if accuracies else None

    # Build FIDE estimates
    rating_estimates = []
    for (platform, time_class), (rating, _) in latest_ratings.items():
        offset = FIDE_OFFSETS.get((platform, time_class), -150)
        fide = max(0, rating + offset)
        rating_estimates.append(RatingEstimate(
            platform=platform,
            time_class=time_class,
            current_rating=rating,
            fide_estimate=fide,
        ))

    # Sort: rapid first, then by platform
    order = {"rapid": 0, "classical": 1, "blitz": 2, "bullet": 3, "daily": 4}
    rating_estimates.sort(key=lambda r: (order.get(r.time_class, 9), r.platform))

    return OverviewStats(
        total_games=total,
        wins=wins,
        losses=losses,
        draws=draws,
        platforms=platforms,
        avg_accuracy=avg_acc,
        rating_history=rating_history,
        rating_estimates=rating_estimates,
    )
