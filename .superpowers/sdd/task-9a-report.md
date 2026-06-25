# Task 9a Report: Scope stats/patterns/tilt/rating-predictor routers to current user

## Status: COMPLETE

## Queries Scoped (exhaustive list)

### `backend/app/routers/stats.py`
| Line | Model | Change |
|------|-------|--------|
| 30 (was 28) | `Game` | `db.query(Game).filter(Game.user_id == user.id).all()` — was `.all()` with no filter |

### `backend/app/routers/patterns.py`
- Router now passes `user_id=user.id` to `PatternEngine(db, user_id=user.id)`.

### `backend/app/routers/tilt.py`
- Router now passes `user_id=user.id` to `TiltDetector(db, user_id=user.id)`.

### `backend/app/routers/rating_predictor.py`
- Router now passes `user_id=user.id` to `RatingPredictor(db, user_id=user.id)`.

### `backend/app/services/pattern_engine.py`
| Location | Model | Change |
|----------|-------|--------|
| `_base_game_query()` (new helper) | `Game` | All Game queries routed through this helper; adds `.filter(Game.user_id == self._user_id)` when user_id is set |
| `_filtered_game_ids()` | `Game` | Now also filters by `user_id` — this propagates to ALL `MoveAnalysis` queries via `_apply_move_filter()` |
| `_opening_stats()` | `Game` | Changed `self.db.query(Game)` → `self._base_game_query()` |
| `_color_stats()` | `Game` | Changed `self.db.query(Game)` → `self._base_game_query()` |
| `_endgame_conversion()` | `MoveAnalysis` | Scoped transitively: `_apply_move_filter()` uses user-scoped game IDs |
| `_phase_accuracy()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |
| `_phase_blunder_rate()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |
| `_missed_tactics()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |
| `_blunder_rate_by_time()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |
| `_blunder_by_move_bucket()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |
| `_worst_blunders()` | `MoveAnalysis` | Scoped transitively via `_apply_move_filter()` |

### `backend/app/services/tilt_detector.py`
| Location | Model | Change |
|----------|-------|--------|
| `analyze()` | `Game` | Added `.filter(Game.user_id == self._user_id)` to the primary game query |
| `_blunder_rate_by_losing_streak()` | `MoveAnalysis` | Scoped transitively: game_ids come from user-scoped `games` list |
| `_session_performance()` | `MoveAnalysis` | Scoped transitively: game IDs come from user-scoped `games` list |

### `backend/app/services/rating_predictor.py`
| Location | Model | Change |
|----------|-------|--------|
| `_get_games()` | `Game` | Added `.filter(Game.user_id == self._user_id)` |
| `_weakness_trends()` | `MoveAnalysis` | Scoped transitively: `game_ids` derived from user-scoped `_get_games()` result |

## Tests

### New test file: `backend/tests/test_router_isolation_9a.py`
- 4 parametrized 401 tests (one per endpoint)
- 4 cross-user isolation tests (stats, patterns, tilt, rating-predictor)
- **8 tests total, all passing**

### Existing tests updated
- `test_api_endpoints.py` — `TestStatsEndpoints` (3 tests) and `TestPatternsEndpoint` (2 tests): switched from `client` to `verified_user_client`, seeded games with `user_id=uid`
- `test_tilt.py` — `TestTiltAPI` (2 tests): switched from `client` to `verified_user_client`, seeded games with `user_id=uid`
- `test_rating_predictor.py` — `TestRatingPredictorAPI` (3 tests) + `_make_games_over_time` helper: switched from `client` to `verified_user_client`, added `user_id` param to helper

**Total existing tests updated: 10 tests across 3 files**

## Full Test Suite
**303 passed, 0 failed** (run: `cd backend && .venv/bin/python -m pytest -q`)

## Commit
`feat: scope stats/patterns/tilt/rating-predictor routers to current user`
