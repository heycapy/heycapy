"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/constants";
import { Sprite } from "@/components/capy/Sprite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { safeNextPath } from "@/lib/auth/next-path";
import { sendOtpAction, verifyOtpAction } from "./actions";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openingApp, startOpeningApp] = useTransition();
  const busy = loading || openingApp;
  const [devCode, setDevCode] = useState("");
  const [devCopied, setDevCopied] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startResendCountdown() {
    setResendCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    const id = setInterval(() => {
      setResendCountdown((n) => {
        if (n <= 1) {
          clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    countdownRef.current = id;
  }

  function handleCopyDevCode() {
    if (!devCode) return;
    void navigator.clipboard.writeText(devCode).then(() => {
      setDevCopied(true);
      setTimeout(() => setDevCopied(false), 1500);
    });
  }

  async function handleSendOtp(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await sendOtpAction(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevCode(result.devCode ?? "");
    setStep("otp");
    startResendCountdown();
  }

  async function handleResend() {
    setError("");
    setCode("");
    setLoading(true);
    const result = await sendOtpAction(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevCode(result.devCode ?? "");
    startResendCountdown();
  }

  async function handleVerifyOtp(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await verifyOtpAction(email, code);
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    startOpeningApp(() => router.push(next));
    setLoading(false);
  }

  function handleBack() {
    setStep("email");
    setCode("");
    setError("");
    setDevCode("");
    setResendCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    []
  );

  const transition: Transition = { duration: 0.22, ease: "easeInOut" };

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Sprite id="capy-idle-blink" size={96} />
        <h1 className="font-pixel text-xl">{APP_NAME}</h1>
      </div>

      <div className="grid w-full max-w-sm">
        <motion.form
          onSubmit={handleSendOtp}
          animate={{ opacity: step === "email" ? 1 : 0, x: step === "email" ? 0 : -16 }}
          transition={transition}
          inert={step !== "email"}
          className="flex flex-col gap-3 [grid-area:1/1]"
        >
          <div>
            <p className="text-foreground text-sm font-medium">Sign in</p>
            <p className="text-muted-foreground text-xs">
              Enter your email and we&apos;ll send you a code.
            </p>
          </div>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={step === "email"}
          />
          <Button type="submit" loading={loading}>
            Send code
          </Button>
          <p
            className={cn("text-xs", error && step === "email" ? "text-destructive" : "invisible")}
          >
            {error || "—"}
          </p>
        </motion.form>

        <motion.form
          onSubmit={handleVerifyOtp}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: step === "otp" ? 1 : 0, x: step === "otp" ? 0 : 16 }}
          transition={transition}
          inert={step !== "otp"}
          className="flex flex-col gap-3 [grid-area:1/1]"
        >
          <div>
            <p className="text-foreground text-sm font-medium">Check your email</p>
            <p className="text-muted-foreground text-xs">
              We sent a 6-digit code to{" "}
              <span className="text-foreground">{email || "your email"}</span>.
            </p>
          </div>
          <OtpInput value={code} onChange={setCode} disabled={busy} focus={step === "otp"} />
          {devCode && (
            <div className="bg-muted flex items-center justify-between rounded px-3 py-2">
              <span className="text-muted-foreground font-mono text-xs">
                dev:{" "}
                <span className="text-foreground font-semibold tracking-widest">{devCode}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyDevCode}
                className="text-muted-foreground hover:text-foreground font-mono text-xs"
              >
                {devCopied ? "copied!" : "[copy]"}
              </button>
            </div>
          )}
          <Button type="submit" loading={busy} disabled={code.length !== 6}>
            Sign in
          </Button>
          <p className={cn("text-xs", error && step === "otp" ? "text-destructive" : "invisible")}>
            {error || "—"}
          </p>
        </motion.form>
      </div>

      <div
        className={cn(
          "flex w-full max-w-sm flex-col items-center",
          step !== "otp" && "pointer-events-none invisible"
        )}
      >
        {resendCountdown > 0 ? (
          <p className="text-muted-foreground py-2.5 text-center text-xs">
            Resend in {resendCountdown}s
          </p>
        ) : (
          <Button type="button" variant="ghost" onClick={handleResend} loading={busy}>
            Resend code
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleBack} disabled={busy}>
          Use a different email
        </Button>
      </div>
    </main>
  );
}
