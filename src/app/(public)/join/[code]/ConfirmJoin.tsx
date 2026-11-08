"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextButton } from "@/components/ui/TextButton";
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
      <TextButton disabled={pending} onClick={join} className="text-foreground text-sm">
        {pending ? "..." : "join"}
      </TextButton>
      {error && (
        <p role="alert" className="text-destructive font-ui text-xs">
          {error}
        </p>
      )}
    </>
  );
}
