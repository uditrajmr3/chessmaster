# Product Documentation

## Vision

ChessMaster is a personalized chess coaching tool that identifies recurring weakness patterns across a player's entire game history and provides actionable training advice.

**Core insight**: Chess.com and Lichess show you what went wrong in a single game. ChessMaster shows you what keeps going wrong across ALL your games — the patterns you can't see yourself.

## Target Users

- **Club-level players** (800-1800 rating) who want to improve systematically
- Players active on Chess.com and/or Lichess
- Players who want data-driven training recommendations, not generic advice

## Key User Stories

### 1. "What are my biggest weaknesses?"
A player with 500+ games wants to know: am I worse in endgames or middlegames? Do I blunder more under time pressure? Which openings should I stop playing?

**Solution**: The Weaknesses page aggregates move analysis across all games and shows phase accuracy, blunder distribution, tactical blind spots, time trouble correlation, and color performance.

### 2. "Give me a personalized training plan"
A player wants specific, actionable advice — not "practice tactics" but "you miss knight forks in middlegame positions when your opponent has a semi-open file."

**Solution**: The AI Coach page uses Claude to generate a personalized report based on the player's actual pattern data, including specific FEN positions from their games and a 30-day training plan.

### 3. "How am I doing in my openings?"
A player wants to know which openings work for them and which don't, backed by win rates and accuracy data.

**Solution**: The Openings page shows a personal opening tree sorted by frequency, with win rate, W/L/D breakdown, and average centipawn loss per opening.

### 4. "What would my FIDE rating be?"
An online player who has never played over-the-board wants a rough estimate of their FIDE rating.

**Solution**: The Dashboard shows FIDE estimates based on community-consensus conversion formulas for each platform and time control.

## Feature Matrix

| Feature | Status | Description |
|---------|--------|-------------|
| Chess.com sync | Done | Fetch all games via public API |
| Lichess sync | Done | Fetch all games via NDJSON API |
| Stockfish analysis | Done | Depth 14 position evaluation |
| Move classification | Done | Good/inaccuracy/mistake/blunder/brilliant |
| Tactical detection | Done | Fork, pin, skewer, back-rank, discovered attack |
| Pattern engine | Done | Cross-game weakness aggregation |
| AI coaching report | Done | Claude-powered personalized report |
| FIDE estimate | Done | Approximate rating conversion |
| Responsive UI | Done | Mobile-optimized layout |
| Interactive game viewer | Done | Color-coded moves with eval details |
| Rating chart | Done | Filtered by platform and time control |

## Metrics for Success

- **Accuracy**: Stockfish analysis matches Chess.com's accuracy scores within 5%
- **Coverage**: Successfully fetches and parses 99%+ of games from both platforms
- **Speed**: Analysis completes within 30 seconds per game at depth 14
- **Usefulness**: AI report identifies at least 3 actionable, non-obvious weaknesses

## Future Roadmap

### Short-term
- Puzzle generator from player's own blunders
- Opening book integration (show theory vs player's moves)
- Export analysis as PDF report

### Medium-term
- Multi-user support with authentication
- PostgreSQL for production deployment
- Drill mode — practice positions similar to your weaknesses
- Peer comparison — compare patterns with players at your level

### Long-term
- Real-time game analysis (connect to live games)
- Mobile app (React Native)
- Training spaced repetition (revisit weak positions over time)
- Coach marketplace — share reports with human coaches
