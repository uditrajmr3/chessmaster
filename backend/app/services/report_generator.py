import json
from datetime import datetime

import anthropic
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Game, Report
from .pattern_engine import PatternEngine

SYSTEM_PROMPT = """You are an experienced chess coach analyzing a player's game history.
You will receive structured data about a player's performance patterns across many games.
Your job is to produce a personalized coaching report that identifies their 3-5 most
significant recurring weaknesses and provides actionable training advice.

Be specific: reference exact openings by name, exact game phases, and include FEN positions
from their actual games as examples. Avoid generic advice like "practice tactics" — instead
say exactly WHAT type of tactic they miss and in WHAT positions.

Focus on PATTERNS that repeat across multiple games, not one-off mistakes.

Structure your response as:
1. **Player Profile Summary** — brief overview of their style and level
2. **Top Weaknesses** — 3-5 systemic issues, each with:
   - Clear description of the pattern
   - Specific example from their games (include FEN)
   - Why this keeps happening (root cause)
   - Concrete training exercise to fix it
3. **Opening Repertoire Advice** — which openings to keep, drop, or add
4. **Strengths to Build On** — what they do well
5. **30-Day Training Plan** — week-by-week focus areas"""


class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db

    async def generate(self) -> Report:
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set in .env")

        pattern_engine = PatternEngine(self.db)
        patterns = pattern_engine.generate_report()

        games = self.db.query(Game).all()
        total_games = len(games)
        if total_games == 0:
            raise RuntimeError("No games found. Sync games first.")

        ratings = [g.player_rating for g in games]
        platforms = {}
        for g in games:
            platforms[g.platform] = platforms.get(g.platform, 0) + 1

        sorted_games = sorted(games, key=lambda g: g.played_at)
        first_game = sorted_games[0].played_at.strftime("%Y-%m-%d")
        last_game = sorted_games[-1].played_at.strftime("%Y-%m-%d")

        user_prompt = self._build_prompt(
            total_games=total_games,
            min_rating=min(ratings),
            max_rating=max(ratings),
            platforms=platforms,
            first_game=first_game,
            last_game=last_game,
            patterns=patterns,
        )

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        report_text = response.content[0].text

        report = Report(
            generated_at=datetime.utcnow(),
            games_count=total_games,
            report_json=json.dumps(patterns),
            report_text=report_text,
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def _build_prompt(self, **kwargs) -> str:
        patterns = kwargs["patterns"]

        # Format opening stats
        opening_lines = []
        for o in patterns.get("opening_stats", [])[:15]:
            wr = (o["wins"] / o["games"] * 100) if o["games"] > 0 else 0
            cpl = o.get("avg_cpl", "N/A")
            opening_lines.append(
                f"  {o['eco']} {o['name']}: {o['games']} games, "
                f"{wr:.0f}% win rate, {cpl} avg CPL"
            )

        # Format missed tactics
        tactics = patterns.get("missed_tactics", {})
        tactic_lines = [f"  {k}: {v} times" for k, v in sorted(tactics.items(), key=lambda x: -x[1])]

        # Format example positions
        examples = patterns.get("example_positions", [])
        example_lines = []
        for e in examples[:8]:
            example_lines.append(
                f"  FEN: {e['fen']}\n"
                f"  Played: {e['player_move']}, Best: {e['best_move']}, "
                f"  CPL: {e['centipawn_loss']:.0f}, Phase: {e['game_phase']}, "
                f"  Tactics missed: {', '.join(e['tactical_motifs']) or 'none'}"
            )

        phase = patterns.get("phase_accuracy", {})
        phase_blunder = patterns.get("phase_blunder_rate", {})
        white = patterns.get("white_stats", {})
        black = patterns.get("black_stats", {})
        blunder_buckets = patterns.get("blunder_by_move_bucket", {})

        return f"""## Player Profile
- Rating range: {kwargs['min_rating']}-{kwargs['max_rating']}
- Games analyzed: {kwargs['total_games']} ({', '.join(f'{p}: {c}' for p, c in kwargs['platforms'].items())})
- Date range: {kwargs['first_game']} to {kwargs['last_game']}

## Opening Performance (sorted by frequency)
{chr(10).join(opening_lines)}

## Worst Openings (min 3 games, by win rate)
{chr(10).join(f"  {o['eco']} {o['name']}: {o['games']} games, {o['wins']}/{o['losses']}/{o['draws']} W/L/D" for o in patterns.get('worst_openings', []))}

## Phase-by-Phase Accuracy (avg centipawn loss per player move)
- Opening: {phase.get('opening', 0)} CPL
- Middlegame: {phase.get('middlegame', 0)} CPL
- Endgame: {phase.get('endgame', 0)} CPL

## Phase Blunder Rates (% of player moves that are blunders)
- Opening: {phase_blunder.get('opening', 0)}%
- Middlegame: {phase_blunder.get('middlegame', 0)}%
- Endgame: {phase_blunder.get('endgame', 0)}%

## Tactical Blind Spots (missed motifs when player blundered)
{chr(10).join(tactic_lines) if tactic_lines else '  No tactical data yet'}

## Time Trouble Analysis
- Blunder rate with normal time (>=60s): {patterns.get('blunder_rate_normal', 0)}%
- Blunder rate in time trouble (<60s): {patterns.get('blunder_rate_time_trouble', 0)}%

## Color Performance
- As White: {white.get('win_rate', 0)}% win rate, {white.get('avg_cpl', 0)} avg CPL ({white.get('games', 0)} games)
- As Black: {black.get('win_rate', 0)}% win rate, {black.get('avg_cpl', 0)} avg CPL ({black.get('games', 0)} games)

## Endgame Conversion
- Won positions entering endgame successfully converted: {patterns.get('endgame_conversion_rate', 0)}%

## Blunder Distribution by Move Number
{chr(10).join(f'  Moves {k}: {v}% blunder rate' for k, v in blunder_buckets.items())}

## Worst Blunders (example positions showing recurring issues)
{chr(10).join(example_lines) if example_lines else '  No analysis data yet'}
"""
