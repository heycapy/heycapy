"use client";

import { useUIStore } from "@/store/ui";
import { BracketButton } from "@/components/ui/BracketButton";

export function NewBucketButton() {
  const { openCreateBucket } = useUIStore();
  return <BracketButton onClick={openCreateBucket}>add bucket</BracketButton>;
}
