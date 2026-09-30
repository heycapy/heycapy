# heycapy

a capy to help you with your day. buckets, deadlines, reminders, telegram and an ai to chat with.

[heycapy.xyz](https://heycapy.xyz) · [how to use](https://heycapy.xyz/how-to-use)

## run it locally

needs node 22+ and pnpm.

```sh
git clone https://github.com/heycapy/heycapy
cd heycapy
pnpm install
cp .env.example .env
```

set `JWT_SECRET` and `ENCRYPTION_KEY` in `.env`, then:

```sh
pnpm dev
```

open [localhost:3000](http://localhost:3000) and sign in with any email. without an email service the sign in code shows on the screen.

## self-host with docker

```sh
git clone https://github.com/heycapy/heycapy
cd heycapy
cp .env.example .env
```

fill in `.env`, put your domain in the `Caddyfile`, then:

```sh
docker compose up -d
```

caddy handles https. the database lives in a docker volume at `/data/heycapy.db`.

## configuration

everything is in `.env.example`. the main ones:

| var | what it's for |
|-----|---------------|
| `JWT_SECRET`, `ENCRYPTION_KEY` | required secrets |
| `DATABASE_URL` | required in production, on persistent storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | sends sign in codes and email reminders (or use `SMTP_*`) |
| `APP_URL` | your public url, for telegram and reminder links |
| `TELEGRAM_BOT_TOKEN` | turns on telegram |
| `ADMIN_EMAILS` | who sees the system tab and gets alerts |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | the ai for users without their own key |

users set up their own ai key, ntfy, smtp and notifications inside the app.

### only for heycapy.xyz

| var | what it's for |
|-----|---------------|
| `HOSTED=true` | users without their own key pay for the server ai in credits |
| `VOICE_PROVIDER` | voice for those users: `gemini`, `groq` or `openai`. off until this and the key are set |
| `VOICE_API_KEY` | the key for the voice provider, never taken from the chat ai |
| `VOICE_MODEL` | optional, defaults to `gemini-3.5-flash-lite`, `whisper-large-v3-turbo` or `whisper-1` |

leave these out when self-hosting.

## running it

- **push notifications** work out of the box over https. on iphone they need "add to home screen".
- **health checks**: `/api/health` for your platform, `/api/health/scheduler` for an uptime monitor (it returns 503 when reminders are stuck).
- **backups**: every night the database is copied to a `backups/` folder next to it, keeping the last 7. copy that folder off the server too.

## stack

next.js · typescript · tailwind · sqlite with drizzle · node-cron
