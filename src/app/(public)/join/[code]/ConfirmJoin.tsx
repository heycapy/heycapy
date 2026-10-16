"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BracketButton } from "@/components/ui/BracketButton";
import { joinBucketAction } from "@/app/(app)/member-actions";

export function ConfirmJoin({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function join() {
    setError("");
    startTransition(async () => {
      const result = await joinBucketAction(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/?bucket=${result.bucketId}`);
    });
  }

  return (
    <>
      <BracketButton disabled={pending} onClick={join} className="text-foreground text-sm">
        {pending ? "..." : "join"}
      </BracketButton>
      {error && (
        <p role="alert" className="text-destructive font-mono text-xs">
          {error}
        </p>
      )}
    </>
  );
}
