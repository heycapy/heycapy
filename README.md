<p align="center">
  <img src=".github/assets/capy-blink.gif" width="96" height="96" alt="capy, the heycapy mascot, blinking">
</p>

<h1 align="center">heycapy</h1>

<p align="center">
  a capy to help you with your day. buckets, deadlines, reminders, telegram and an ai to chat with.
</p>

<p align="center">
  <a href="https://heycapy.xyz">heycapy.xyz</a> · <a href="https://heycapy.xyz/how-to-use">how to use</a>
</p>

## run it locally

needs node 22+ and pnpm.

```sh
git clone https://github.com/heycapy/heycapy
cd heycapy
pnpm install
cp .env.example .env
```

in `.env`, set `JWT_SECRET` to the output of `openssl rand -base64 32` and `ENCRYPTION_KEY` to the output of `openssl rand -hex 32`, then:

```sh
pnpm dev
```

open [localhost:3000](http://localhost:3000) and sign in with any email. without an email service the sign in code shows on the screen.

## self-host with docker

needs docker with compose, and a domain pointing at your server for https.

```sh
git clone --branch v0.1.0 https://github.com/heycapy/heycapy
cd heycapy
cp .env.example .env
```

in `.env`:

- `JWT_SECRET`: the output of `openssl rand -base64 32`
- `ENCRYPTION_KEY`: the output of `openssl rand -hex 32`. keep it safe, keys and tokens saved in the app can't be read without it
- `APP_URL`: the address you'll open heycapy at, e.g. `https://heycapy.example.com`
- `RESEND_API_KEY` and `EMAIL_FROM` (or the `SMTP_*` lines), so sign in codes reach people by email

in `Caddyfile`, replace `yourdomain.com` with your domain. then:

```sh
docker compose up -d --build
```

open your domain. caddy gets the https certificate on its own. the database lives in a docker volume at `/data/heycapy.db`.

if something's missing heycapy won't start and says what to fix: `docker compose logs heycapy`. the logs mention `localhost:3000`, that's only inside docker, caddy is the way in.

### try it on your own machine first

set `APP_URL=http://localhost`, put `:80` instead of the domain in `Caddyfile`, and open [localhost](http://localhost). email is optional like this: without it the sign in code shows on the screen, which heycapy only allows when `APP_URL` is localhost.

### upgrading

back up first, then move to the new version:

```sh
docker compose cp heycapy:/data ./heycapy-backup
git fetch --tags
git checkout v0.1.1
docker compose up -d --build
```

the database updates itself on start. what changed is in [CHANGELOG.md](CHANGELOG.md).

## configuration

everything is in `.env.example`. the main ones:

| var | what it's for |
|-----|---------------|
| `JWT_SECRET`, `ENCRYPTION_KEY` | required secrets |
| `DATABASE_URL` | required in production, on persistent storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | sends sign in codes and email reminders (or use `SMTP_*`). required in production unless `APP_URL` is localhost |
| `APP_URL` | your public url, for telegram and reminder links. required in production |
| `TELEGRAM_BOT_TOKEN` | turns on telegram |
| `ADMIN_EMAILS` | who sees the system tab and gets alerts |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | the ai for users without their own key. leave them out and each user adds their own in tweaks → ai |

users set up their own ai key, ntfy, smtp and notifications inside the app.

### only for heycapy.xyz

| var | what it's for |
|-----|---------------|
| `HOSTED=true` | users without their own key pay for the server ai in credits. chat and voice then use the models and prices in `src/lib/ai/tiers.ts` instead of `AI_PROVIDER` / `AI_MODEL` / `AI_API_KEY`. also refuses ollama, and ntfy or smtp servers on a private network (localhost, 192.168.x.x, docker names), so a local ntfy stops working |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | one key per provider the tiers use. the server won't start while one it needs is missing |

leave these out when self-hosting.

## running it

- **push notifications** work out of the box over https. on iphone they need "add to home screen".
- **health checks**: `/api/health` for your platform, `/api/health/scheduler` for an uptime monitor (it returns 503 when reminders are stuck).
- **backups**: every night the database is copied to a `backups/` folder next to it, keeping the last 7. copy that folder off the server too.

## stack

next.js · typescript · tailwind · sqlite with drizzle · node-cron
