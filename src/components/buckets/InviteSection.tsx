import { useEffect, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BracketButton } from "@/components/ui/BracketButton";
import { createInviteAction, listInvitesAction, revokeInviteAction } from "@/app/(app)/actions";
import { INVITE_TTL_MS } from "@/lib/buckets/constants";
import { formatInviteCode } from "@/lib/buckets/invite-code";
import type { PendingInvite } from "@/lib/buckets/invites";

const HINT = "text-muted-foreground font-mono text-[11px] leading-tight";
const COPY_BUTTON =
  "text-muted-foreground hover:text-foreground shrink-0 font-mono text-[11px] transition-colors";
const INVITE_QR_SIZE = 144;
const HOUR_MS = 60 * 60 * 1000;

type Fresh = { code: string; link: string };
type Copied = "code" | "link";

function hoursLeft(expiresAt: Date): number {
  return Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / HOUR_MS));
}

export function InviteSection({ bucketId }: { bucketId: number }) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [copied, setCopied] = useState<Copied | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const result = await listInvitesAction(bucketId);
    if (result.ok) setInvites(result.invites);
  }

  useEffect(() => {
    let cancelled = false;
    void listInvitesAction(bucketId).then((result) => {
      if (!cancelled && result.ok) setInvites(result.invites);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId]);

  function create() {
    setError("");
    startTransition(async () => {
      const result = await createInviteAction(bucketId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const origin = result.appUrl ?? window.location.origin;
      setFresh({ code: result.code, link: `${origin}/join/${result.code}` });
      setCopied(null);
      await refresh();
    });
  }

  function cancel(inviteId: number) {
    setError("");
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId);
      if (!result.ok) setError(result.error);
      if (invites.at(-1)?.id === inviteId) setFresh(null);
      await refresh();
    });
  }

  function copy(kind: Copied, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 1500);
      },
      () => setError("couldn't copy, select it and copy by hand")
    );
  }

  return (
    <div className="border-border flex flex-col gap-3 border-t pt-4">
      <p className="text-muted-foreground font-mono text-xs">invite someone</p>
      <p className={HINT}>
        send a code or a link, they join with one tap. each works once and lasts{" "}
        {INVITE_TTL_MS / HOUR_MS} hours.
      </p>
      <BracketButton onClick={create} disabled={pending} className="w-fit">
        {pending ? "..." : "create invite"}
      </BracketButton>

      {fresh && (
        <div className="border-border flex flex-col gap-2.5 border p-3">
          <div className="flex items-center justify-between gap-2">
            <span
              data-testid="invite-code"
              className="font-mono text-sm font-bold tracking-widest select-all"
            >
              {formatInviteCode(fresh.code)}
            </span>
            <button type="button" onClick={() => copy("code", fresh.code)} className={COPY_BUTTON}>
              {copied === "code" ? "[copied]" : "[copy code]"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={fresh.link}
              onFocus={(e) => e.target.select()}
              aria-label="invite link"
              className="border-border focus:border-foreground w-full border-b bg-transparent py-1.5 font-mono text-xs outline-none"
            />
            <button type="button" onClick={() => copy("link", fresh.link)} className={COPY_BUTTON}>
              {copied === "link" ? "[copied]" : "[copy link]"}
            </button>
          </div>
          <QRCodeSVG
            value={fresh.link}
            size={INVITE_QR_SIZE}
            marginSize={4}
            title="scan to join this bucket"
            role="img"
            className="self-start"
          />
          <p className={HINT}>
            this code is only shown now. share it only with the person you mean to invite.
          </p>
        </div>
      )}

      {invites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={HINT}>open invites</p>
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground font-mono text-xs">
                expires in {hoursLeft(invite.expiresAt)}h
              </span>
              <BracketButton
                variant="destructive"
                onClick={() => cancel(invite.id)}
                disabled={pending}
              >
                cancel
              </BracketButton>
            </div>
          ))}
        </div>
      )}

      {error && <span className="text-destructive font-mono text-xs">{error}</span>}
    </div>
  );
}
