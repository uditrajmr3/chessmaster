# Contributing to ChessMaster

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Stockfish](https://stockfishchess.org/download/) binary (for analysis features)
- Git

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
# Edit .env with your STOCKFISH_PATH and ANTHROPIC_API_KEY
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend (109 tests)
cd backend
pytest -v

# Frontend (19 tests)
cd frontend
npm test
```

## Code Organization

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system architecture.

**Backend key areas:**
- `app/services/` — Core business logic (analysis, pattern detection, API clients)
- `app/routers/` — API endpoint handlers
- `app/models.py` — Database models
- `tests/` — Test suite

**Frontend key areas:**
- `src/app/` — Next.js pages (App Router)
- `src/components/` — Reusable React components
- `src/lib/` — API client and TypeScript types

## How to Contribute

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if relevant
- Your platform/browser/Python version

### Suggesting Features

Open an issue with the `enhancement` label. Describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `pytest` and `npm test`
6. Ensure the frontend builds: `cd frontend && npm run build`
7. Commit with a clear message describing the change
8. Push and open a PR

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Update tests for any behavior changes
- Don't introduce new dependencies without discussion
- Match existing code style (no linter config changes in feature PRs)
- Update documentation if your change affects the API or architecture

## Code Style

### Python (Backend)
- Follow PEP 8
- Use type hints for function signatures
- Use Pydantic models for API request/response schemas
- Keep services focused — one responsibility per service class

### TypeScript (Frontend)
- Use TypeScript strictly — no `any` types
- Use functional components with hooks
- Keep components focused — extract sub-components when they grow
- Use the `api` client from `src/lib/api.ts` for all backend calls

## Areas for Contribution

Here are some areas where contributions are welcome:

- **Opening book integration** — Show theoretical moves alongside player's moves
- **Puzzle generation** — Generate puzzles from the player's own blunders
- **Multi-user support** — Authentication, user accounts, PostgreSQL migration
- **Game import** — Support PGN file upload in addition to API sync
- **Visualization** — Heatmaps, piece activity charts, pawn structure analysis
- **Mobile app** — React Native or PWA support
- **Lichess OAuth** — Access private games via OAuth token
- **Batch export** — Export analysis data as CSV/PDF

## Questions?

Open a discussion or issue on GitHub.
