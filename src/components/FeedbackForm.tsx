"use client";

import { useEffect, useRef, useState } from "react";

const COOLDOWN_MS = 60_000;
const COOLDOWN_STEPS = 60;

export function FeedbackForm({ fallbackEmail }: { fallbackEmail?: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => {
      const left = Math.max(0, cooldownUntil - Date.now());
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        setCooldownUntil(null);
        setSent(false);
      }
    }, 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    const email =
      (formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.value.trim() ?? "";
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email: email || undefined }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
      setMessage("");
      formRef.current?.reset();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setRemaining(COOLDOWN_MS / 1000);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    } catch {
      setError(
        fallbackEmail
          ? `something went wrong. sorry about that. reach me at ${fallbackEmail}`
          : "something went wrong. sorry about that."
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    const filled = Math.ceil((remaining / (COOLDOWN_MS / 1000)) * COOLDOWN_STEPS);
    const boxes = "▪".repeat(filled) + "·".repeat(COOLDOWN_STEPS - filled);
    return (
      <div className="border-border border p-4">
        <p className="font-pixel mb-2 text-[11px]">feedback</p>
        <p className="text-muted-foreground font-mono text-[11px]">
          got it. thanks. <span className="opacity-40">[{boxes}]</span>
        </p>
      </div>
    );
  }

  return (
    <div className="border-border border p-4">
      <p className="font-pixel mb-3 text-[11px]">feedback</p>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          placeholder="say something..."
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          maxLength={1000}
          rows={1}
          className="border-border text-foreground placeholder:text-muted-foreground/40 w-full resize-none overflow-y-auto border-b bg-transparent py-1.5 font-mono text-[11px] leading-relaxed outline-none"
        />
        <input
          type="email"
          name="email"
          placeholder="your email (optional)"
          className="border-border text-foreground placeholder:text-muted-foreground/40 w-full border-b bg-transparent py-1.5 font-mono text-[11px] outline-none"
        />
        {error && (
          <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">{error}</p>
        )}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className={`text-muted-foreground font-mono text-[10px] transition-colors ${message.trim() && !sending ? "hover:text-foreground" : "pointer-events-none opacity-30"}`}
          >
            <span className="opacity-50">[</span>
            {sending ? "sending..." : "send ↵"}
            <span className="opacity-50">]</span>
          </button>
        </div>
      </form>
    </div>
  );
}
