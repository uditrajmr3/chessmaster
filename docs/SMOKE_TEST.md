# Manual Smoke Test Checklist

End-to-end happy path for a human to verify after deployment or a major change.

## Prerequisites

1. Docker running (`docker info` succeeds)
2. Node.js 18+ (`node --version`)
3. Python 3.11+ venv set up (`backend/.venv/`)
4. Stockfish WASM files dropped into `frontend/public/stockfish/`:
   ```bash
   cd frontend
   npm install stockfish
   cp node_modules/stockfish/src/stockfish.js   public/stockfish/stockfish.js
   cp node_modules/stockfish/src/stockfish.wasm public/stockfish/stockfish.wasm
   ```

---

## Step 1 — Start infrastructure

```bash
# From repo root
docker compose up -d db
# Verify Postgres is up:
docker compose ps    # db should be "healthy" or "running"
```

---

## Step 2 — Run migrations

```bash
cd backend
alembic upgrade head
# Expected output: "Running upgrade ... -> <head-revision>"
# (No output = already at head, that's fine too)
```

---

## Step 3 — Start the backend

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload
```

Verify: open `http://localhost:8000/api/health` in a browser.
Expected response: `{"status":"ok","stockfish_available":false,"stockfish_path":null}`

---

## Step 4 — Start the frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. You should see the landing page or be redirected to `/login`.

---

## Step 5 — Register User A

1. Navigate to `http://localhost:3000/register`
2. Enter email `usera@example.com` and a password
3. Click **Create account**
4. Expected: redirected to a "check your email" page

**Dev: get the verification link**

If `RESEND_API_KEY` is not set in `backend/.env`, the token is printed to the backend terminal:

```
INFO:     Verification link: http://localhost:3000/verify-email?token=<token>
```

Copy and open that URL in the browser.

Expected: "Email verified" confirmation.

---

## Step 6 — Log in as User A

1. Navigate to `http://localhost:3000/login`
2. Enter the email and password from Step 5
3. Click **Log in**
4. Expected: redirected to the dashboard (`/`)
5. The sidebar should show the user's email and a **Logout** link

---

## Step 7 — Link chess platform usernames

1. Navigate to `http://localhost:3000/settings`
2. Enter a valid Lichess username (e.g. `DrNykterstein`) in the Lichess field
3. Enter a valid Chess.com username (e.g. `magnuscarlsen`) in the Chess.com field
4. Click **Save**
5. Expected: success toast / confirmation

---

## Step 8 — Sync games

1. Click **Sync Games** in the sidebar
2. Expected: a progress indicator appears; status changes from "syncing" to "done"
3. Navigate to `http://localhost:3000/games`
4. Expected: a list of games appears for the linked usernames

---

## Step 9 — Run browser analysis

1. Navigate to the **Analysis** page (check sidebar)
2. Click **Analyze Games** (or it may start automatically)
3. Stockfish WASM runs in the browser — watch the progress bar increment
4. When complete, navigate to **Weaknesses** (`/weaknesses`)
5. Expected: pattern cards with phase accuracy, tactical blind spots, etc.

---

## Step 10 — Data isolation (User B)

1. Open a new private/incognito browser window
2. Navigate to `http://localhost:3000/register`
3. Register `userb@example.com` with a different password
4. Verify email (same dev trick — check backend terminal for the link)
5. Log in as User B
6. Navigate to `http://localhost:3000/games`
7. Expected: **empty list** — User B sees no games from User A

**Confirm via API** (optional):
```bash
# While logged in as User B in the browser, open DevTools → Network
# Any GET /api/games request should return [] if User B has no games
```

---

## Step 11 — Password reset flow

1. Log out as User A (`/logout` or sidebar button)
2. Navigate to `http://localhost:3000/forgot-password`
3. Enter `usera@example.com`
4. Click **Send reset link**
5. Check backend terminal for the reset link (same dev trick as verification)
6. Open the link, set a new password
7. Log in with the new password — expected: success

---

## Automated suites (for CI reference)

```bash
# Backend — 378 tests
cd backend && .venv/bin/python -m pytest -q

# Frontend — 96 tests
cd frontend && npx jest

# Frontend build
cd frontend && npm run build
```

All three should complete with no errors.
