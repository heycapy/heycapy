import { useEffect, useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  changeUsernameAction,
  checkUsernameAction,
  getUsernameAction,
  suggestUsernameAction,
} from "@/app/(app)/actions";
import type { UsernameAllowance, UsernameAvailability } from "@/lib/account/username";
import { normalizeUsername, usernameProblem } from "@/lib/account/username-rules";
import { allowanceLine, canChangeUsername, renameWarning } from "@/lib/account/username-allowance";
import { USERNAME_MAX_LENGTH } from "@/lib/account/constants";
import { cn } from "@/lib/utils";
import { ConfirmRow } from "./ConfirmRow";
import { HINT, INPUT, MUTED, USERNAME_CHECK_DEBOUNCE_MS } from "./settings-constants";

type UsernameFieldProps = {
  username: string;
  // null until the person types, kept by the sheet so switching tabs doesn't lose it
  draft: string | null;
  onDraft: (draft: string | null) => void;
  onSaved: (username: string) => void;
};

type Check = { name: string; availability: UsernameAvailability };

function checkLine(availability: UsernameAvailability | null): { text: string; ok: boolean } {
  if (!availability) return { text: "checking...", ok: false };
  switch (availability.status) {
    case "available":
      return { text: "✓ available", ok: true };
    case "taken":
      return { text: "that username is taken", ok: false };
    case "invalid":
      return { text: availability.problem, ok: false };
    case "same":
      return { text: "", ok: false };
  }
}

export function UsernameField({ username, draft, onDraft, onSaved }: UsernameFieldProps) {
  const [allowance, setAllowance] = useState<UsernameAllowance | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getUsernameAction().then((result) => {
      if (!cancelled && result.ok) setAllowance(result.allowance);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = draft === null ? username : normalizeUsername(draft);
  const changed = name !== username;
  const problem = changed ? usernameProblem(name) : null;
  const needsCheck = changed && problem === null;

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const id = setTimeout(() => {
      void checkUsernameAction(name).then((result) => {
        if (!cancelled && result.ok) setCheck({ name, availability: result.availability });
      });
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [name, needsCheck]);

  const availability = check?.name === name ? check.availability : null;
  const line = problem ? { text: problem, ok: false } : needsCheck ? checkLine(availability) : null;
  const allowed = allowance !== null && canChangeUsername(allowance);
  const busy = pending || !allowed;

  function edit(value: string) {
    setError("");
    setConfirming(false);
    onDraft(value.toLowerCase());
  }

  function cancel() {
    setError("");
    setConfirming(false);
    onDraft(null);
  }

  function generate() {
    setError("");
    setConfirming(false);
    startTransition(async () => {
      const result = await suggestUsernameAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCheck({ name: result.username, availability: { status: "available" } });
      onDraft(result.username);
    });
  }

  function requestSave() {
    if (allowance && renameWarning(name, allowance)) setConfirming(true);
    else save();
  }

  function save() {
    setError("");
    setConfirming(false);
    startTransition(async () => {
      const result = await changeUsernameAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAllowance(result.allowance);
      onSaved(result.username);
      onDraft(null);
    });
  }

  const warning = confirming && allowance ? renameWarning(name, allowance) : null;

  return (
    <div className="flex flex-col gap-2">
      <input
        value={draft ?? username}
        onChange={(e) => edit(e.target.value)}
        maxLength={USERNAME_MAX_LENGTH}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label="username"
        disabled={busy}
        className={INPUT}
      />
      {line && line.text && (
        <p
          role="status"
          data-testid="username-check"
          className={cn(
            HINT,
            line.ok ? "text-primary" : problem || availability ? "text-destructive" : ""
          )}
        >
          {line.text}
        </p>
      )}
      {warning ? (
        <ConfirmRow
          text={warning}
          onConfirm={save}
          onCancel={() => setConfirming(false)}
          disabled={pending}
        />
      ) : (
        allowed && (
          <div className="flex flex-wrap gap-3">
            {changed && (
              <BracketButton
                onClick={requestSave}
                disabled={busy || availability?.status !== "available"}
              >
                {pending ? "saving..." : "save username"}
              </BracketButton>
            )}
            <BracketButton onClick={generate} disabled={busy}>
              generate another
            </BracketButton>
            {changed && (
              <BracketButton onClick={cancel} disabled={pending}>
                cancel
              </BracketButton>
            )}
          </div>
        )
      )}
      {allowance && (
        <p className={MUTED} data-testid="username-allowance">
          {allowanceLine(allowance)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive font-mono text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
