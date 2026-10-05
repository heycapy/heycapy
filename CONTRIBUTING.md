# contributing

thanks for wanting to help. heycapy is a small project run by one person, so a short note first keeps us both from wasting time.

## before you start

- **bugs and small fixes**: open a pull request straight away, or an issue if you're not sure it's a bug.
- **features and bigger changes**: open an issue first and describe what you want and why. I may say no, or want it built differently, and I'd rather tell you before you write the code.
- **security problems**: don't open an issue or a pull request. follow [SECURITY.md](SECURITY.md).

## run it locally

needs node 22+ and pnpm. the steps are in the [README](README.md#run-it-locally). `pnpm dev` starts the app on [localhost:3000](http://localhost:3000).

## checks

a pull request needs all of these to pass, the same ones CI runs:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
pnpm test:e2e
```

- unit and integration tests are in `tests/unit` and `tests/integration` (vitest, the integration ones use a real SQLite file).
- end to end tests are in `tests/e2e` (playwright). install the browsers once with `pnpm exec playwright install chromium firefox webkit`. `pnpm test:e2e` builds the app and starts it on port 3100 with its own database, so it never touches yours.
- the pre-commit hook (husky) runs all of the above plus the build, so a commit takes a while. that is on purpose.
- a change that fixes a bug or adds behaviour needs a test that fails without it.

## commits and pull requests

- one change per pull request, with its tests. don't mix a fix and a refactor.
- commit messages follow [conventional commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). commitlint checks them on commit.
- write code that reads like the code around it: same naming, same structure, comments only for a "why" that isn't obvious.
- anything that can change an item's reminders must call `refreshItemReminders` / `refreshBucketReminders` / `refreshUserReminders` (`src/lib/reminders/refresh.ts`).
- a new database migration needs a `when` in `meta/_journal.json` that is higher than the last one. migrations only go forward.
- say in the pull request what changed and how you checked it. a screenshot helps for anything you can see.

## license

by contributing you agree that your work is released under the [MIT license](LICENSE).
