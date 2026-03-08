# Roadmap

Future features prioritized by impact on player improvement.

## Priority 1 — High Impact

### Puzzle Trainer from Your Own Blunders
Turn your actual blunder positions into a drill. The data already exists — positions where you blundered and the best moves Stockfish found. Show the position, make you find the right move. Add spaced repetition so the same patterns come back until you stop missing them. This is the single most valuable feature to add.

**Why**: Generic puzzle trainers teach random patterns. This trains YOUR specific blind spots from YOUR actual games.

### Time Management Profile
Build a visualization of how you spend your clock. Chart time spent per move vs move number, highlight where you over-think book moves and under-think critical decisions. Show stats like "You spend 45s on move 5 (book moves you should know) but only 3s on move 25 (critical middlegame decisions)."

**Why**: At the 800-1200 level, poor time allocation is often a bigger problem than tactical knowledge. The clock data already exists in every analyzed game.

### Tilt & Streak Detection
Track win/loss streaks and correlate blunder rate with consecutive losses. Show behavioral insights like "After 2 losses in a row, your blunder rate doubles. You should stop playing after 2 consecutive losses."

**Why**: Behavioral change with zero chess knowledge needed. Tilt is one of the biggest rating killers at every level.

### Pre-Game Opponent Scouting
Enter an opponent's username before a game. The app fetches their recent games, cross-references with your opening repertoire, and recommends: "This player always plays the Sicilian as black. You score 35% against the Sicilian. Consider playing 1.d4 instead."

**Why**: Gives a concrete competitive edge in every game. Especially valuable in tournaments or against repeat opponents.

## Priority 2 — Medium Impact

### Endgame Drill Detection
Scan games for endgames you lost or drew from theoretically winning positions. Classify by type: K+P vs K, rook endgames, bishop vs knight, etc. Report: "You've lost 8 rook endgames from winning positions. Here are the 3 endgame types to study."

**Why**: Endgame skill is the most efficient way to gain rating at the club level. Knowing which specific endgame types to study saves time.

### Rating Predictor
Use improvement trajectory and pattern data to project future rating. "At your current improvement rate, you'll hit 1200 in ~4 months." Adjusts based on whether weakness patterns are actually improving over time.

**Why**: Motivating and keeps players engaged with the improvement process.

### Weekly Email Digest
Auto-sync games weekly, run analysis, and email a short summary: "This week: 12 games, 58% win rate, you missed 3 forks. Your endgame CPL improved by 8 points." No need to even open the app.

**Why**: Reduces friction. Most players won't open an analysis tool daily, but they'll read an email.

### Peer Comparison
Aggregate anonymous data to compare against players at the same rating band. Show: "Average 1000-rated player blunders 8% of moves. You blunder 11%. But your opening CPL is better than average."

**Why**: Context for whether a weakness is unusual or normal for your level.

## Priority 3 — Nice to Have

### Live Post-Game Review
Connect to ongoing games via Lichess/Chess.com API. After the game ends, immediately show a move-by-move breakdown while the game is fresh in memory. Don't show anything during the game (that's cheating).

**Why**: The best time to learn from a mistake is 30 seconds after you make it, not days later.

### Opening Book Integration
Show theoretical moves alongside the player's moves in the game viewer. Highlight where the player deviates from book and whether the deviation was good or bad.

### Game Import via PGN Upload
Support uploading PGN files directly, for OTB games or games from other platforms.

### Export & Sharing
Export analysis data as CSV/PDF. Share coaching reports with human coaches. Generate shareable progress summaries.

### Mobile App
React Native or PWA for on-the-go access to analysis and puzzle training.

## Implementation Order

When building these features, the recommended order is:

1. Puzzle trainer from blunders (direct ROI on rating)
2. Time management profile (low-hanging fruit, data already exists)
3. Tilt detection (behavioral, easy to implement)
4. Pre-game scouting (competitive edge)
5. Endgame drill detection
6. Everything else based on user feedback
