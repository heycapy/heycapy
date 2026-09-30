# heycapy

a capy to help you with your day. buckets, deadlines, reminders, webhooks, telegram, ai chat. self-hosted via docker.

→ [heycapy.xyz](https://heycapy.xyz) · [how to use](https://heycapy.xyz/how-to-use)

---

## running locally

requires node 20+ and pnpm.

```sh
git clone https://github.com/heycapy/heycapy
cd heycapy
pnpm install
```

copy the env file and fill it in:

```sh
cp .env.example .env
```

the only required vars to get started:

```
# generate with: openssl rand -base64 32
JWT_SECRET=

# generate with: openssl rand -hex 32
ENCRYPTION_KEY=

# resend.com — used to send OTP login emails. free tier works fine.
RESEND_API_KEY=re_...

# must match a verified domain in your resend account
EMAIL_FROM=HeyCapy <noreply@yourdomain.com>
```

run migrations and start:

```sh
pnpm db:migrate
pnpm dev
```

open [http://localhost:3000](http://localhost:3000). you'll be asked to log in with your email — resend sends the OTP.

---

## self-hosting with docker

```sh
git clone https://github.com/heycapy/heycapy
cd heycapy
cp .env.example .env
```

fill in `.env`, then edit the `Caddyfile` with your domain:

```
your-domain.com {
    reverse_proxy heycapy:3000
}
```

start everything:

```sh
docker compose up -d
```

caddy handles HTTPS automatically. data lives in a docker volume at `/data/heycapy.db`.

---

## environment variables

| var | required | description |
|-----|----------|-------------|
| `JWT_SECRET` | yes | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | yes | `openssl rand -hex 32` |
| `RESEND_API_KEY` | yes | resend.com api key — used for OTP login emails |
| `EMAIL_FROM` | yes | must match a verified domain in resend (e.g. `HeyCapy <noreply@yourdomain.com>`) |
| `DATABASE_URL` | yes in production | sqlite file, e.g. `file:/data/heycapy.db` — must be on persistent storage (the docker volume / fly mount); the app refuses to start in production without it |
| `TELEGRAM_BOT_TOKEN` | no | telegram bot token — only needed if you want telegram. use a separate bot for local development, never the production one |
| `ADMIN_EMAILS` | no | comma-separated emails that see the **system** tab in tweaks (scheduler status, failed deliveries, recent server errors with stack traces) and get alerts: critical errors (app restarted by the watchdog, backup failed) right away, everything else in an hourly digest — by email and telegram, whichever each admin has set up |
| `HOSTED` | no | `true` only on a server that sells capy to others (heycapy.xyz): users without their own ai key then use the server's ai (`AI_*` below) and pay for it in credits, 1 per capy answer, with free credits to start; admins give or take credits in the **system** tab. leave it unset when self-hosting: there are no credits and everyone may use the server's ai |
| `AI_PROVIDER` / `AI_MODEL` / `AI_API_KEY` | no | the server's own ai (`ollama`, `openai`, `anthropic`, `groq`, `gemini`), for users who haven't added a key of their own. `OLLAMA_URL` points at the server's ollama. heycapy.xyz: `gemini` / `gemini-3.5-flash-lite` |
| `GEMINI_API_KEY` / `VOICE_MODEL` | no | with `HOSTED=true`: voice in capy's chat for users on heycapy ai, sent to gemini (`VOICE_MODEL`, default `gemini-3.5-flash-lite`). `GEMINI_API_KEY` isn't needed when `AI_PROVIDER=gemini`: `AI_API_KEY` is used. voice is free but needs credits left, up to 2 minutes a recording |
| `APP_URL` | no | your app's public url — required for telegram webhooks, and for the done / remind-again buttons in email and ntfy reminders |

everything else (ntfy, ai provider, smtp, notifications) is configured per-user inside the app.

### push notifications

web push works out of the box: the server generates its keys on first use and keeps them in the database (`server_secrets`), so don't reset that table or every device has to turn push on again. it needs https (localhost is fine for development). on iphone, push only works after "add to home screen" (ios 16.4+).

### health checks

- `GET /api/health` — the app and database are up (safe for your platform's health check)
- `GET /api/health/scheduler` — `503` when no reminder run has finished in 5 minutes. point an uptime monitor (e.g. uptimerobot, better stack) at it so you get alerted. don't use it for platform routing checks: a stuck scheduler shouldn't take the site down
- in production, if the scheduler is stuck for 10 minutes the app exits so the platform restarts it (fly's default restart policy does this)

### backups

every night at 03:40 (server time) the app copies the database to a `backups/` folder next to it (e.g. `/data/backups/heycapy-2026-09-28.db`) and keeps the last 7. to restore, stop the app and copy a backup over the database file. copy the folder off the server too — a backup on the same disk won't survive losing that disk.

---

## stack

next.js 16 · typescript · tailwind css · sqlite + drizzle · node-cron
