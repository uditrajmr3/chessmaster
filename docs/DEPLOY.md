# Deploying ChessMaster to Render

This deploys three pieces from one blueprint (`render.yaml`):

- **chessmaster-db** — managed Postgres
- **chessmaster-api** — FastAPI backend (Docker)
- **chessmaster-web** — Next.js frontend, which proxies `/api/*` to the backend
  so the browser only ever talks to one origin (keeps the auth cookie
  first-party — no CORS/SameSite headaches).

---

## Prerequisites (gather these first)

| Thing | Where | Used for |
|-------|-------|----------|
| Render account | https://render.com (connect your GitHub) | hosting + Postgres |
| A domain | Cloudflare / Porkbun / Namecheap | site URL + email sending |
| Resend API key | https://resend.com | sending verification/reset emails |
| Anthropic API key | https://console.anthropic.com | AI coaching reports |
| `SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_hex(32))"` | signs JWT/verify/reset tokens |

---

## Step 1 — Push the repo to GitHub

Render deploys from a connected Git repo. Make sure `master` is up to date:

```bash
git push origin master
```

## Step 2 — Create the Blueprint on Render

1. Render Dashboard → **New** → **Blueprint**.
2. Select this repository. Render reads `render.yaml` and shows the three
   resources (db + api + web). Click **Apply**.
3. The first build will start. The `api` service runs `alembic upgrade head`
   (its pre-deploy command) to create the schema, then boots `uvicorn`.

## Step 3 — Set the secret env vars (api service)

In **chessmaster-api → Environment**, fill the values marked `sync: false`:

| Key | Value |
|-----|-------|
| `SECRET_KEY` | the 64-char hex you generated |
| `RESEND_API_KEY` | from Resend (Step 5) |
| `ANTHROPIC_API_KEY` | from Anthropic |
| `EMAIL_FROM` | `ChessMaster <noreply@yourdomain.com>` |
| `FRONTEND_URL` | your public web URL (Step 4), e.g. `https://chessmaster.yourdomain.com` |
| `CORS_ORIGINS` | JSON list, e.g. `["https://chessmaster.yourdomain.com"]` |

`DATABASE_URL`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax` are wired
automatically by the blueprint. (Without `RESEND_API_KEY`, the app still runs —
verification/reset tokens are printed to the api service logs instead of
emailed, which is handy for a first smoke test.)

Re-deploy the api service after setting these.

## Step 4 — Custom domain on the web service

1. Buy a domain; in **chessmaster-web → Settings → Custom Domains**, add
   e.g. `chessmaster.yourdomain.com`.
2. At your DNS provider, add the **CNAME** Render shows (points the subdomain at
   the web service). HTTPS is provisioned automatically.
3. Set `FRONTEND_URL` and `CORS_ORIGINS` (Step 3) to this domain and redeploy.

> Until you add a domain, the web service is reachable at its
> `chessmaster-web-XXXX.onrender.com` URL — fine for a first smoke test. Set
> `FRONTEND_URL`/`CORS_ORIGINS` to that onrender URL in the meantime.

## Step 5 — Verify your email domain in Resend

1. Resend → **Domains** → add your domain → it lists DNS records (SPF/DKIM, a
   `MX`/`TXT` or two).
2. Add those records at your DNS provider; wait for Resend to mark it
   **Verified**.
3. Use an address on that domain for `EMAIL_FROM`.

## Step 6 — Smoke test

Follow [`docs/SMOKE_TEST.md`](./SMOKE_TEST.md): register → verify (check the api
logs for the link if email isn't set up yet) → log in → set your Lichess/Chess.com
usernames in **/settings** → sync → run a browser analysis → confirm a second
user can't see your data.

**Specifically confirm the in-browser analysis works** (click "Analyze Games" and
watch progress) — the Stockfish WASM worker is the one piece that depends on the
runtime environment. If it stalls, see Troubleshooting.

---

## Notes & known limitations

- **Free tier:** free web services spin down when idle (cold start ~30–60s on the
  next request); free Postgres has a limited lifespan. For real use, bump the
  `plan:` for each service in `render.yaml` (e.g. `starter` web, `basic-256mb`
  Postgres) and redeploy.
- **Single instance only (for now):** sync/analysis/report *progress status* is
  held in process memory, so keep `chessmaster-api` at **one instance**. Moving
  that status to Postgres/Redis is the follow-up before horizontal scaling.
- **Migrations** run automatically via the api `preDeployCommand`. To run one
  manually: open a Render **Shell** on the api service and run
  `alembic upgrade head`.

## Troubleshooting

- **Login "works" but you're immediately logged out** → the auth cookie isn't
  sticking. Confirm `COOKIE_SECURE=true` (you're on HTTPS) and that the browser
  is hitting the **web** origin (not the api origin directly). The single-origin
  proxy means you should only ever load the web URL.
- **Analysis button does nothing / console error loading the worker** → the
  Stockfish files didn't get fetched. Confirm the web build ran
  `npm run fetch-stockfish` and that
  `/stockfish/stockfish-18-lite-single.js` + `.wasm` are served. See
  `frontend/public/stockfish/README.md`.
- **`alembic upgrade head` fails on first deploy** → check the api service has
  `DATABASE_URL` (auto-wired) and that the db finished provisioning; redeploy.
- **DB driver error (`postgresql://` vs psycopg)** → handled automatically;
  `config.py` rewrites the scheme to `postgresql+psycopg://`.
