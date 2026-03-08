import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AnalysisJob, Game, MoveAnalysis
from ..schemas import GameDetail, GameSummary, MoveAnalysisOut

router = APIRouter(tags=["games"])


@router.get("/games", response_model=list[GameSummary])
def list_games(
    platform: str | None = None,
    time_class: str | None = None,
    result: str | None = None,
    opening: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Game)
    if platform:
        q = q.filter(Game.platform == platform)
    if time_class:
        q = q.filter(Game.time_class == time_class)
    if result:
        q = q.filter(Game.result == result)
    if opening:
        q = q.filter(Game.opening_eco == opening)

    q = q.order_by(Game.played_at.desc())
    games = q.offset((page - 1) * per_page).limit(per_page).all()

    analyzed_ids = {
        row.game_id
        for row in db.query(AnalysisJob.game_id)
        .filter(AnalysisJob.status == "completed")
        .all()
    }

    result_list = []
    for g in games:
        opponent = g.black_username if g.player_color == "white" else g.white_username
        result_list.append(
            GameSummary(
                id=g.id,
                platform=g.platform,
                player_color=g.player_color,
                time_class=g.time_class,
                result=g.result,
                result_detail=g.result_detail,
                player_rating=g.player_rating,
                opponent_rating=g.opponent_rating,
                opponent_name=opponent,
                opening_eco=g.opening_eco,
                opening_name=g.opening_name,
                num_moves=g.num_moves,
                played_at=g.played_at,
                platform_accuracy=g.platform_accuracy,
                is_analyzed=g.id in analyzed_ids,
            )
        )
    return result_list


@router.get("/games/{game_id}", response_model=GameDetail)
def get_game(game_id: str, db: Session = Depends(get_db)):
    g = db.query(Game).filter(Game.id == game_id).first()
    if not g:
        from fastapi import HTTPException
        raise HTTPException(404, "Game not found")

    opponent = g.black_username if g.player_color == "white" else g.white_username
    moves_raw = (
        db.query(MoveAnalysis)
        .filter(MoveAnalysis.game_id == game_id)
        .order_by(MoveAnalysis.move_number)
        .all()
    )

    moves = []
    for m in moves_raw:
        motifs = json.loads(m.tactical_motifs) if m.tactical_motifs else None
        moves.append(
            MoveAnalysisOut(
                move_number=m.move_number,
                is_player_move=bool(m.is_player_move),
                fen_before=m.fen_before,
                move_uci=m.move_uci,
                move_san=m.move_san,
                eval_before=m.eval_before,
                eval_after=m.eval_after,
                best_move_uci=m.best_move_uci,
                best_move_san=m.best_move_san,
                centipawn_loss=m.centipawn_loss,
                classification=m.classification,
                game_phase=m.game_phase,
                time_remaining=m.time_remaining,
                tactical_motifs=motifs,
            )
        )

    return GameDetail(
        id=g.id,
        platform=g.platform,
        pgn=g.pgn,
        player_color=g.player_color,
        time_class=g.time_class,
        result=g.result,
        player_rating=g.player_rating,
        opponent_rating=g.opponent_rating,
        opponent_name=opponent,
        opening_eco=g.opening_eco,
        opening_name=g.opening_name,
        played_at=g.played_at,
        moves=moves,
    )
