"use client";

import { useRef, useState } from "react";

export function FeedbackForm({ fallbackEmail }: { fallbackEmail?: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    return (
      <div className="border-border border p-4">
        <p className="font-pixel mb-2 text-[11px]">feedback</p>
        <p className="text-muted-foreground font-mono text-[11px]">got it. thanks.</p>
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
