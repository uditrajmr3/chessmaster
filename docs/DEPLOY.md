# Deploying ChessInt (Azure)

ChessInt runs on a single Azure Ubuntu VM as four `docker compose` containers:

- **caddy** (`caddy:2-alpine`) — the only container publishing host ports (80, 443). Terminates TLS and reverse-proxies everything else.
- **web** — Next.js frontend, internal only, reachable as `web:3000`.
- **api** — FastAPI backend, internal only, reachable as `api:8000`.
- **db** — `postgres:18`, internal only, reachable as `db:5432`, no published port.

Named volumes: `chessmaster_pg_prod`, `caddy_data`, `caddy_config`.

Routing (`Caddyfile`): host `chessmaster.cyou` + `www.chessmaster.cyou`; `handle /api/*` → `reverse_proxy api:8000`; everything else → `reverse_proxy web:3000`. Single origin, so the auth cookie stays first-party — no CORS/SameSite=None needed. Caddy also sets HSTS (max-age 31536000, includeSubDomains, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` denying camera/mic/geolocation, and strips the `Server` header. Compression is zstd + gzip.

There is no CI/CD — deploys are manual by design. Nothing auto-deploys on push.

---

## Deploying a change

The common case, five steps:

```bash
# 1. From your dev machine
git push origin master

# 2. SSH into the VM
ssh azureuser@20.244.106.101

# 3. Pull the change
cd /opt/chessmaster/app && git pull

# 4. Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verify
curl -s https://chessmaster.cyou/api/health   # → {"status":"ok"}
```

> Any change to a `NEXT_PUBLIC_*` value needs the `--build` above, not just
> a restart — see the gotcha in **Notes & known limitations**.

---

## Prerequisites / access

| Thing | Where | Used for |
|-------|-------|----------|
| SSH key `~/.ssh/id_rsa` | operator's machine | `ssh azureuser@20.244.106.101` |
| Home IP allow-listed in `chessmaster-nsg` | Azure Portal / `az network nsg rule update` | port 22 access (rotates — see Troubleshooting) |
| Repo write access | GitHub, `master` branch | source of truth the VM pulls from |
| `/opt/chessmaster/app/.env` | VM only, mode 600 | all runtime secrets (not in git, not on any dev machine — the repo is public) |
| Azure Key Vault `chessmaster-kv` | resource group `chessmaster-rg` | VM reads secrets via managed identity |

Infrastructure, provisioned 2026-07-20 (resource group `chessmaster-rg`, region `centralindia`):

- VM `chessmaster-vm` — `Standard_B2s_v2` (2 vCPU / 8 GB), availability zone 2, Ubuntu 24.04
- Static public IP `20.244.106.101` — the DNS A-record target
- NSG `chessmaster-nsg` — port 22 open only to the operator's home IP; 80/443 open to the world
- App directory `/opt/chessmaster/app` — a git clone of this repo's `master`

---

## Environment & secrets

Root `.env` on the VM (mode 600, ~22 keys) feeds all four services via `env_file: .env` in `docker-compose.prod.yml`.

| Group | Keys |
|-------|------|
| Backend/runtime | `DATABASE_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEMPLATE_ID`, `FRONTEND_URL`, `CORS_ORIGINS`, `ACCESS_TOKEN_LIFETIME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (Razorpay keys are **LIVE**) |
| Compose/infra | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `ACME_EMAIL` |
| Frontend build args | `BACKEND_URL` (default `http://api:8000`), `NEXT_PUBLIC_API_URL` (default `/api`), `NEXT_PUBLIC_GA_ID` |

Production values in use: `FRONTEND_URL=https://chessmaster.cyou`, `CORS_ORIGINS=["https://chessmaster.cyou"]`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`.

`backend/.env.example` documents the backend subset for local dev. Generate a new `SECRET_KEY` with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> **The most important gotcha.** `NEXT_PUBLIC_*` vars are inlined by Next.js at **build time**. Passing them via compose `env_file:` (runtime-only) does not work — they must be declared as `ARG` in `frontend/Dockerfile` and passed as compose `build.args`, which `docker-compose.prod.yml` now does. When this was wired wrong, the client bundle fell back to `http://localhost:8000/api`, so every browser's API calls hit the visitor's own machine: login appeared broken ("Something went wrong") for every user while the backend was perfectly healthy, and Google Analytics silently disabled itself. **Consequence: any change to a `NEXT_PUBLIC_*` value requires a rebuild (`--build`), not just a restart.** Verify after deploy by confirming no served chunk contains `localhost:8000`.

---

## DNS & TLS

DNS (Namecheap), TTL Automatic (1799s, so changes take up to ~30 min to propagate):

- A `@` → `20.244.106.101`
- A `www` → `20.244.106.101`
- Leave the email records alone — they're unrelated to hosting: TXT `_dmarc`, TXT `resend._domainkey` (DKIM), TXT `send` (SPF, amazonses), MX `send` (Resend), plus a Google verification TXT.

TLS is automatic via Caddy + Let's Encrypt (ACME HTTP-01). The contact address comes from `ACME_EMAIL` in the root `.env`; Caddy proceeds without one if it's unset. Certs cover both apex and `www` and auto-renew — no manual action needed.

> Don't start Caddy before DNS actually resolves to the VM. ACME HTTP-01 will fail and Caddy backs off exponentially, delaying cert issuance well past the point DNS is fixed.

---

## Migrations

Migrations run automatically on `api` container start. `backend/Dockerfile`'s CMD is:

```
sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
```

`alembic upgrade head` is idempotent — a no-op once current. To run one manually:

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

## Ops commands

All run from `/opt/chessmaster/app` on the VM.

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api   # or web, caddy, db

# Status
docker compose -f docker-compose.prod.yml ps

# Restart one service
docker compose -f docker-compose.prod.yml restart api

# Psql shell
docker compose -f docker-compose.prod.yml exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Validate Caddy config after editing the Caddyfile
docker compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reclaim disk after repeated --build
docker image prune -f
```

---

## Backups

`scripts/backup-db.sh` takes a `pg_dump` custom-format dump; dumps land in `~/backups/chessmaster/` with a `.latest` pointer file. Verify a dump is restorable before trusting it:

```bash
pg_restore --list <dump>
```

> `scripts/` is currently untracked in git — this script lives only on the operator's machine, not in the repo. A fresh clone or a new operator won't have it. Committing it is a known gap worth closing.

This script is not yet wired to a schedule — backups are currently manual.

---

## Smoke test

Follow [`docs/SMOKE_TEST.md`](./SMOKE_TEST.md): register → verify → log in → set your Lichess/Chess.com usernames in **/settings** → sync → run a browser analysis → confirm a second user can't see your data.

**Specifically confirm the in-browser analysis works** (click "Analyze Games" and watch progress) — the in-browser Stockfish WASM analysis is the piece most sensitive to the runtime environment.

---

## Notes & known limitations

- `postgres:18` requires the volume mounted at `/var/lib/postgresql`, NOT `/var/lib/postgresql/data`. The 18 images keep data in a major-version subdirectory so `pg_upgrade --link` works without crossing a mount boundary; the entrypoint refuses to start if it finds data at the old path (docker-library/postgres#1259). The dev `docker-compose.yml` still uses `postgres:16`.
- Don't start Caddy before DNS actually resolves to the VM — see the DNS & TLS gotcha above.
- Lockfile drift only reproduces in the deploy image. `npm ci` under `node:22-alpine` (npm 10.9.8) fails on missing nested entries that npm 11+ silently auto-heals locally. Always test a `frontend/package-lock.json` change in the deploy image, not on your Mac. Repair with `npm install --package-lock-only` (minimal nested-entry patch), never a from-scratch regeneration.
- Azure SKU: `Standard_B2s` (v1) does not exist in `centralindia`. `Standard_B2s_v2` does, but is `NotAvailableForSubscription` in zone 1 — pin `--zone 2` (or 3). `az vm create`'s error handler can crash with "content already consumed" and mask the real error; diagnose with `az vm list-skus -l centralindia` instead.
- Single instance only: sync/analysis/report *progress status* is held in process memory, so the `api` service must stay at one replica. Moving that state to Postgres/Redis is the prerequisite for horizontal scaling.

## Troubleshooting

- **Login "works" but you're immediately logged out** → the auth cookie isn't sticking. Confirm `COOKIE_SECURE=true` and that the browser is on the `chessmaster.cyou` origin. The single-origin Caddy proxy means you should only ever load the site URL, never the api container directly.
- **Login shows "Something went wrong"** → almost always the `NEXT_PUBLIC` build-arg bug above. Check the served JS bundle for `localhost:8000`.
- **Analysis button does nothing / console error loading the worker** → Stockfish files weren't fetched. The frontend build must run `npm run fetch-stockfish`; confirm `/stockfish/stockfish-18-lite-single.js` and `.wasm` are served (the `.wasm` is ~7.3 MB). See `frontend/public/stockfish/README.md`.
- **`alembic upgrade head` fails on api start** → check `DATABASE_URL` in `.env` and that the `db` container passed its healthcheck (`docker compose -f docker-compose.prod.yml ps`). The api service already waits on `condition: service_healthy`.
- **DB driver error (`postgresql://` vs psycopg)** → handled automatically; `config.py` rewrites the scheme to `postgresql+psycopg://`.
- **Cert not issuing / site serves a self-signed warning** → check `docker compose -f docker-compose.prod.yml logs caddy` for ACME errors, confirm DNS resolves to `20.244.106.101`, and confirm ports 80 and 443 are open in the NSG. HTTP-01 needs port 80 reachable.
- **Can't SSH** → the NSG allows port 22 from one home IP only, and home IPs rotate. Re-open it for your current IP in the Azure portal or via `az network nsg rule update`.
