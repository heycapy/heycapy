import { cn } from "@/lib/utils";
import { useEffect, useState, useTransition } from "react";
import { TextButton, TextLink } from "@/components/ui/TextButton";
import { AvatarEditor, type AvatarDraft } from "@/components/avatar/AvatarEditor";
import {
  deleteAccountAction,
  getDeletionBlockersAction,
  sendAccountDeletionCodeAction,
} from "@/app/(app)/actions";
import type { SharedBucket } from "@/lib/account/delete";
import { UsernameField } from "./UsernameField";
import { charCountColor } from "@/components/ui/input";
import { TIMEZONE_MAX_LENGTH } from "@/constants";
import { BOX, INPUT, SECTION, MUTED, HINT } from "./settings-constants";

type Step = "idle" | "confirm" | "code";

type AccountTabProps = {
  email: string;
  username: string | null;
  usernameDraft: string | null;
  onUsernameDraft: (draft: string | null) => void;
  onUsernameSaved: (username: string) => void;
  avatarDraft: AvatarDraft;
  onAvatarDraft: (draft: AvatarDraft) => void;
  timezone: string;
  onTimezone: (timezone: string) => void;
  saving: boolean;
};

export function AccountTab({
  email,
  username,
  usernameDraft,
  onUsernameDraft,
  onUsernameSaved,
  avatarDraft,
  onAvatarDraft,
  timezone,
  onTimezone,
  saving,
}: AccountTabProps) {
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [sharedBuckets, setSharedBuckets] = useState<SharedBucket[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getDeletionBlockersAction().then((result) => {
      if (!cancelled && result.ok) setSharedBuckets(result.buckets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function reset() {
    setStep("idle");
    setCode("");
    setDevCode("");
    setError("");
  }

  function sendCode() {
    setError("");
    startTransition(async () => {
      const result = await sendAccountDeletionCodeAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDevCode(result.devCode ?? "");
      setStep("code");
    });
  }

  function confirmDelete() {
    setError("");
    startTransition(async () => {
      // On success the action redirects to the login page
      const result = await deleteAccountAction(code);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {username && (
        <div className={BOX}>
          <span className={SECTION}>username</span>
          <p className={MUTED}>the name other people see when you share a bucket.</p>
          <UsernameField
            username={username}
            draft={usernameDraft}
            onDraft={onUsernameDraft}
            onSaved={onUsernameSaved}
          />
        </div>
      )}

      <div className={BOX}>
        <span className={SECTION}>avatar</span>
        <AvatarEditor draft={avatarDraft} onDraft={onAvatarDraft} />
      </div>

      <div className={BOX}>
        <span className={SECTION}>timezone</span>
        <input
          type="text"
          aria-label="timezone"
          value={timezone}
          onChange={(e) => onTimezone(e.target.value)}
          placeholder="America/New_York"
          maxLength={TIMEZONE_MAX_LENGTH}
          disabled={saving}
          className={INPUT}
        />
        {timezone.length > 0 && (
          <p
            className={cn(
              "font-ui text-2xs -mt-2 text-right transition-colors",
              charCountColor(timezone.length, TIMEZONE_MAX_LENGTH)
            )}
          >
            {timezone.length}/{TIMEZONE_MAX_LENGTH}
          </p>
        )}
      </div>

      <div className={BOX}>
        <span className={SECTION}>your data</span>
        <p className={MUTED}>
          one file with your buckets, items, settings, notification history and chats. secrets like
          api keys and passwords are never included.
        </p>
        <TextLink href="/api/account/export" download className="text-primary self-start py-0">
          download my data
        </TextLink>
      </div>

      <div className={BOX}>
        <span className={SECTION}>delete account</span>
        {step === "idle" && (
          <>
            <p className={MUTED}>permanently deletes {email} and everything in it.</p>
            {sharedBuckets.length > 0 && (
              <p className={cn(HINT, "leading-relaxed")}>
                you still own {sharedBuckets.map((bucket) => bucket.name).join(", ")}, shared with
                other people. make someone else the owner (bucket settings → members), delete{" "}
                {sharedBuckets.length === 1 ? "it" : "them"}, or remove everyone before you delete
                your account.
              </p>
            )}
            <TextButton
              variant="destructive"
              onClick={() => setStep("confirm")}
              disabled={sharedBuckets.length > 0}
              className="self-start"
            >
              delete account
            </TextButton>
          </>
        )}

        {step === "confirm" && (
          <>
            <p className="text-destructive font-ui text-2xs leading-relaxed">
              this deletes everything: buckets, items, history, settings and your telegram
              connection. it can&apos;t be undone. copies in the nightly backups are gone within 7
              days. download your data first if you want to keep it.
            </p>
            <div className="flex gap-3">
              <TextButton variant="destructive" onClick={sendCode} disabled={pending}>
                {pending ? "sending..." : "email me a code"}
              </TextButton>
              <TextButton onClick={reset} disabled={pending}>
                cancel
              </TextButton>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <p className={MUTED}>enter the 6-digit code we sent to {email}</p>
            {devCode && <p className={MUTED}>dev code: {devCode}</p>}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="deletion code"
              placeholder="000000"
              disabled={pending}
              className={INPUT}
            />
            <div className="flex gap-3">
              <TextButton
                variant="destructive"
                onClick={confirmDelete}
                disabled={pending || code.length !== 6}
              >
                {pending ? "deleting..." : "delete forever"}
              </TextButton>
              <TextButton onClick={reset} disabled={pending}>
                cancel
              </TextButton>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-destructive font-ui text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
