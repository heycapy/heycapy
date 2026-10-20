import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  adjustUsernameBonusAction,
  getUserUsernameAction,
  renameUserAction,
  type UserUsername,
} from "@/app/(app)/actions";
import type { ActionResult } from "@/types/result";
import { allowanceLine } from "@/lib/account/username-allowance";
import { USERNAME_MAX_LENGTH } from "@/lib/account/constants";
import { formatShort } from "@/lib/format-date";
import { BOX, INPUT, SECTION, MUTED } from "./settings-constants";

export function SystemUsernames() {
  const [email, setEmail] = useState("");
  const [rename, setRename] = useState("");
  const [user, setUser] = useState<UserUsername | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult<{ user: UserUsername }>>, clear = false) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setUser(result.user);
        setRename("");
      } else {
        if (clear) setUser(null);
        setError(result.error);
      }
    });
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>usernames</span>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => getUserUsernameAction(email), true);
        }}
      >
        <input
          type="email"
          aria-label="email to find a username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user's email"
          disabled={pending}
          className={cn(INPUT, "min-w-0 flex-1")}
        />
        <BracketButton
          type="submit"
          disabled={pending || !email.trim()}
          className="shrink-0 whitespace-nowrap"
        >
          find
        </BracketButton>
      </form>

      {user && (
        <>
          <div className="flex flex-col gap-0.5">
            <p className={cn(MUTED, "break-all")}>{user.email}</p>
            <p className="font-mono text-xs break-all" data-testid="admin-username">
              {user.username ?? "no username yet"}
            </p>
            <p className={MUTED}>{allowanceLine(user.allowance)}</p>
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameUserAction({ email: user.email, username: rename }));
            }}
          >
            <input
              aria-label="new username"
              value={rename}
              onChange={(e) => setRename(e.target.value.toLowerCase())}
              placeholder="new username"
              maxLength={USERNAME_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              className={cn(INPUT, "min-w-0 flex-1")}
            />
            <BracketButton
              type="submit"
              disabled={pending || !rename.trim()}
              className="shrink-0 whitespace-nowrap"
            >
              rename
            </BracketButton>
          </form>
          <p className={MUTED}>
            a rename here never uses their changes and can take a name someone else just let go of.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs" data-testid="admin-username-bonus">
              {user.allowance.bonus} bonus
            </span>
            <BracketButton
              onClick={() => run(() => adjustUsernameBonusAction({ email: user.email, delta: 1 }))}
              disabled={pending}
            >
              +1
            </BracketButton>
            <BracketButton
              onClick={() => run(() => adjustUsernameBonusAction({ email: user.email, delta: -1 }))}
              disabled={pending || user.allowance.bonus === 0}
            >
              −1
            </BracketButton>
          </div>

          {user.changes.length === 0 ? (
            <p className={MUTED}>never changed</p>
          ) : (
            <ul className="divide-border/50 border-border flex max-h-48 flex-col divide-y divide-dotted overflow-y-auto border px-2">
              {user.changes.map((change) => (
                <li key={change.id} className={cn(MUTED, "flex flex-col py-1")}>
                  <span>
                    {formatShort(new Date(change.createdAt))}
                    {change.byAdmin && " · by an admin"}
                  </span>
                  <span className="text-foreground break-words">
                    {change.oldUsername ?? "none"} → {change.newUsername}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="text-destructive font-mono text-xs">{error}</p>}
    </div>
  );
}
