@AGENTS.md

# HeyCapy

A self-hosted personal life OS built around buckets — clean ordered lists for tasks, subscriptions, reminders, and external data feeds. Self-hosted via Docker. Single Next.js full-stack app.

**Domain:** heycapy.xyz
**Design brief:** /home/watermelon/projects/life-os.md
**Tech spec:** /home/watermelon/projects/heycapy-tech.md

---

## Stack

- **Framework:** Next.js 16 (App Router) — full-stack, no separate backend
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york style)
- **Database:** SQLite + Drizzle ORM (`lib/db/`)
- **Auth:** Email OTP via Resend, JWT sessions (30-day, httpOnly cookie)
- **Scheduler:** node-cron in custom `server.ts` — runs every minute
- **Notifications:** Resend (email) + ntfy (push)
- **AI:** Unified provider abstraction (Ollama / OpenAI / Anthropic) in `lib/ai/`
- **State:** Zustand for client UI state, Server Components for data
- **Package manager:** pnpm

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (REST endpoints)
│   ├── (auth)/             # Auth pages (login, setup)
│   ├── (app)/              # Authenticated app pages
│   ├── globals.css         # Design tokens + Tailwind
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # App shell, navigation
│   └── providers/          # Client providers (theme, toaster)
├── hooks/                  # Custom React hooks
├── lib/
│   ├── db/                 # Drizzle schema + client
│   ├── ai/                 # Unified AI provider abstraction
│   ├── notifications/      # Resend + ntfy providers
│   ├── scheduler/          # node-cron deadline checker
│   ├── mcp/                # MCP adapters (Linear etc.)
│   ├── templates/          # Built-in bucket templates
│   └── utils.ts            # cn() utility
├── store/                  # Zustand stores
└── types/                  # Shared TypeScript types
tests/                      # Playwright E2E tests
```

---

## Core Concepts

### Buckets
Named containers for items. Each bucket has a **rulebook** (JSON) with three namespaces: `notifications`, `items`, `mcp`, `personality`.

### Items
Title + deadline + recurring config + per-item notification override.

### Rulebook
```ts
{
  notifications: { medium, notify_at, quiet_hours, default_offset, repeat, snooze_until },
  items: { sort_by, drag, readonly, auto_archive_after, show_completed, default_deadline_offset },
  mcp: { source, refresh_mode, refresh_interval_mins },
  personality: { tone_override }
}
```

### Scheduler
`node-cron` in `server.ts` runs every minute. Checks `deadline - offset <= now AND notified_at IS NULL`. Fires via configured notification provider. Respects `quiet_hours` and `snooze_until`.

### AI Layer
Two jobs: (1) NL input → parse bucket + item, (2) bucket setup assistant. Unified interface — swap provider without changing app logic.

---

## Auth Flow

1. User visits `/login` → enters email
2. OTP sent via Resend (6-digit, 10-min TTL)
3. User enters OTP → JWT issued → httpOnly cookie (30-day)
4. All routes behind middleware auth check

---

## Coding Conventions

### General
- Clean, minimal, readable code — no unnecessary comments
- No speculative features — only build what is asked
- No extra abstractions for one-time use
- Stability and long-term maintainability over everything
- Validate input at boundaries — zod preferred
- Always handle async errors — never swallow exceptions
- Environment variables via `.env` — never hardcode secrets

### TypeScript
- Strict mode always on
- `const` over `let`, never `var`
- `type` over `interface` unless extending
- `import type { ... }` for type-only imports always
- No `any` types
- No non-null assertions (`!`)

### React / Next.js
- Functional components only
- `"use client"` only when needed (hooks, event handlers, browser APIs)
- Server Components fetch from DB directly — no client-side data fetching layer
- Server Actions for mutations — call `revalidatePath` after DB writes
- Zustand for UI state only (open/close, modals, AI input) — no RTK Query
- Custom hooks for reusable logic
- Small, focused components

### Styling
- Tailwind only — no inline styles, no custom CSS unless Tailwind cannot achieve it
- Mobile-first responsive design
- CSS variables for all colors — never hardcode hex in components
- All className merging via `cn()` from `@/lib/utils`

### Database
- `user_id` on every DB table — schema is multi-user from day one

---

## Environment Variables

```
RESEND_API_KEY=
EMAIL=                    # OTP delivery target + notification email
JWT_SECRET=               # Random 32-byte secret
NTFY_URL=                 # e.g. https://ntfy.sh or self-hosted
NTFY_TOPIC=               # ntfy topic name
AI_PROVIDER=              # ollama | openai | anthropic
AI_API_KEY=               # not needed for ollama
AI_MODEL=                 # e.g. llama3.2, gpt-4o, claude-sonnet-4-6
OLLAMA_URL=               # http://localhost:11434 (if AI_PROVIDER=ollama)
```

---

## Git Conventions

Conventional Commits enforced via commitlint:
- `feat:` new feature
- `fix:` bug fix
- `chore:` tooling, deps
- `refactor:` no behaviour change
- `test:` tests only
- `docs:` documentation

---

## What NOT To Do

- No `localStorage` access outside of Zustand persist middleware
- No `console.log` — use proper error handling
- No hardcoded hex colors — use CSS variables
- No direct DB calls from Client Components
- No `any` types
- No non-null assertions (`!`)
- Never bypass auth middleware
