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
| `TELEGRAM_BOT_TOKEN` | no | telegram bot token — only needed if you want telegram |
| `APP_URL` | no | your app's public url — required for telegram webhooks to work |

everything else (ntfy, ai provider, smtp, notifications) is configured per-user inside the app.

---

## stack

next.js 16 · typescript · tailwind css · sqlite + drizzle · node-cron
