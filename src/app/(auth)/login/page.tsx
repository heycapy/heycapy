"use client";

import { useState, useEffect, useRef } from "react";
import { type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/constants";
import { Sprite } from "@/components/capy/Sprite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { sendOtpAction, verifyOtpAction } from "./actions";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

  function logDevOtp(devCode?: string) {
    // eslint-disable-next-line no-console
    if (devCode) console.log(`[dev] OTP: ${devCode}`);
  }

  async function handleSendOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await sendOtpAction(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    logDevOtp(result.devCode);
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
    logDevOtp(result.devCode);
    startResendCountdown();
  }

  async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await verifyOtpAction(email, code);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
  }

  function handleBack() {
    setStep("email");
    setCode("");
    setError("");
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
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Sprite id="capy-mascot" size={96} />
        <h1 className="font-pixel text-xl">{APP_NAME}</h1>
      </div>

      <div className="grid w-full max-w-sm">
        <motion.form
          onSubmit={handleSendOtp}
          animate={{ opacity: step === "email" ? 1 : 0, x: step === "email" ? 0 : -16 }}
          transition={transition}
          className={cn(
            "flex flex-col gap-3 [grid-area:1/1]",
            step !== "email" && "pointer-events-none"
          )}
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
          className={cn(
            "flex flex-col gap-3 [grid-area:1/1]",
            step !== "otp" && "pointer-events-none"
          )}
        >
          <div>
            <p className="text-foreground text-sm font-medium">Check your email</p>
            <p className="text-muted-foreground text-xs">
              We sent a 6-digit code to{" "}
              <span className="text-foreground">{email || "your email"}</span>.
            </p>
          </div>
          <OtpInput value={code} onChange={setCode} disabled={loading} focus={step === "otp"} />
          <Button type="submit" loading={loading} disabled={code.length !== 6}>
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
          <Button type="button" variant="ghost" onClick={handleResend} loading={loading}>
            Resend code
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleBack}>
          Use a different email
        </Button>
      </div>
    </main>
  );
}
