"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/constants";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Something went wrong. Try again.");
      return;
    }

    setStep("otp");
  }

  async function handleVerifyOtp(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Invalid or expired code. Try again.");
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
          <p className="text-muted-foreground text-sm">
            {step === "email"
              ? "Enter your email to sign in"
              : `Check your email — we sent a code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-center text-sm tracking-widest outline-none focus:ring-1"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="text-muted-foreground w-full text-sm"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="text-destructive text-center text-sm">{error}</p>}
      </div>
    </main>
  );
}
