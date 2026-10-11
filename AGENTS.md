<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HeyCapy

A self-hosted personal organizer built around buckets — clean ordered lists for tasks, subscriptions, reminders, and external data feeds. Single Next.js full-stack app, self-hosted via Docker. Domain: heycapy.xyz.

## Stack

- **Framework:** Next.js 16 (App Router), full-stack, no separate backend
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 + shadcn/ui (new-york style)
- **Database:** SQLite + Drizzle ORM (`lib/db/`)
- **Auth:** email OTP, JWT sessions (30-day, httpOnly cookie)
- **Scheduler:** node-cron, started from `instrumentation.ts`, runs every minute
- **Notifications:** email, ntfy, web push, Telegram, outgoing webhooks
- **AI:** provider abstraction (Ollama / OpenAI / Anthropic / Gemini) in `lib/ai/`
- **State:** Zustand for client UI state, Server Components for data
- **Package manager:** pnpm

## Project Structure

```
src/
├── app/                    # App Router: (auth), (app), (public), api/
├── components/             # ui/ (shadcn primitives), layout/, buckets/, capy/, ...
├── hooks/                  # Custom React hooks
├── lib/                    # db/, ai/, notifications/, reminders/, scheduler/, buckets/, items/, ...
├── store/                  # Zustand stores
└── types/                  # Shared TypeScript types
tests/
├── e2e/                    # Playwright
├── integration/            # Vitest against a real SQLite DB
└── unit/                   # Vitest, mirrors src/
```

## Core Concepts

- **Buckets:** named containers for items, shareable with other members (`bucket_members`; the access rule lives only in `lib/buckets/access.ts`). Each bucket has rules: `notifications`, `items`, `mcp`, `personality`.
- **Items:** title, deadline (`deadline_timezone` = the clock it was set on), recurrence, assignee, reminder offsets.
- **Reminders:** one schedule per item and recipient (`item_reminders`: `next_reminder_at`, `next_overdue_at`, indexed). The rules (offsets, notify-at, quiet hours, daily repeat, each person on their own clock) live in `lib/reminders/schedule.ts`.
  - Any write that can change an item's reminders must call `refreshItemReminders` / `refreshBucketReminders` / `refreshUserReminders` (`lib/reminders/refresh.ts`).
  - The scheduler only fetches due rows and re-checks each against live state before sending. A full `reconcile()` runs at startup and hourly, so a missed refresh delays a reminder instead of losing it.
- **Migrations:** keep `when` in `meta/_journal.json` increasing (`tests/integration/migrations.test.ts` enforces it).

## Workflow

- **One change at a time.** Every bug fix or feature, with its tests, is committed and pushed on its own before the next one starts.
- The agent does not commit. When a change is done and verified, stop and give the user the file list and a Conventional Commit message.
- Track work in `docs/progress.md`; update it when starting and finishing an item.
- **Never over-engineer.** Pick the most straightforward solution that fully solves the problem.
- **Comments only for the non-obvious "why".** Never restate a name or what the code plainly does.

## Coding Conventions

### General
- No speculative features, no abstractions for one-time use
- Validate input at boundaries (zod)
- Always handle async errors, never swallow exceptions
- Environment variables via `.env`, never hardcode secrets
- **Hard limit: no component file over 350 lines.** Split into focused sub-components first.

### TypeScript
- Strict mode; `const` over `let`, never `var`
- `type` over `interface` unless extending
- `import type { ... }` for type-only imports
- No `any`, no non-null assertions (`!`)
- Never the `React.` namespace; import named exports from `"react"`
- Constants and enums in a dedicated `constants.ts`, never inline in component or logic files

### Zod (v4 APIs)
- `z.email()`, `z.url()`, `z.iso.datetime()`, `z.iso.date()`, not the `z.string().x()` forms

### React / Next.js
- Functional components; `"use client"` only when needed
- Server Components fetch from the DB directly; Server Actions for mutations, `revalidatePath` after DB writes
- Zustand for UI state only; custom hooks for reusable logic; small, focused components

### Styling
- Tailwind only, mobile-first; no inline styles or custom CSS unless Tailwind can't do it
- CSS variables for all colors, never hardcoded hex
- Merge classNames with `cn()` from `@/lib/utils`

### Database
- `user_id` on every table

## Git

Conventional Commits, enforced by commitlint: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`.

## What NOT To Do

- No `localStorage` outside Zustand persist middleware
- No `console.log`
- No direct DB calls from Client Components
- Never bypass the auth check in `proxy.ts`
- Never use decorative separator comments (`// ────`, `/* ── Section ── */`)
