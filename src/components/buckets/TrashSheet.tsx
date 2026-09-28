import { useEffect, useState, useTransition } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  getDeletedBucketsAction,
  restoreDeletedBucketAction,
  permanentlyDeleteBucketAction,
} from "@/app/(app)/actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type TrashSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function TrashSheet({ open, onClose }: TrashSheetProps) {
  useScrollLock(open);
  const router = useRouter();
  const [deleted, setDeleted] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setConfirmId(null);
      setError("");
      setLoading(true);
      void getDeletedBucketsAction().then((result) => {
        if (result.ok) setDeleted(result.buckets);
        setLoading(false);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  function handleRestore(bucketId: number) {
    startTransition(async () => {
      setError("");
      const result = await restoreDeletedBucketAction(bucketId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      setDeleted((prev) => prev.filter((b) => b.id !== bucketId));
    });
  }

  function handlePermanentDelete(bucketId: number) {
    startTransition(async () => {
      await permanentlyDeleteBucketAction(bucketId);
      router.refresh();
      setDeleted((prev) => prev.filter((b) => b.id !== bucketId));
      setConfirmId(null);
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 sm:w-80"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">trash</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <p className="text-muted-foreground/60 border-border border-b px-4 py-2 font-mono text-[10px]">
              permanently deleted buckets and all their items cannot be recovered
            </p>
            {error && (
              <p className="text-destructive border-border border-b px-4 py-2 font-mono text-[10px]">
                {error}
              </p>
            )}

            <div className="flex flex-1 flex-col overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  loading...
                </p>
              ) : deleted.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  trash is empty
                </p>
              ) : (
                <div className="divide-border divide-y">
                  {deleted.map((bucket) => (
                    <div key={bucket.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-pixel truncate text-xs">{bucket.name}</p>
                        {bucket.deletedAt && (
                          <p className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">
                            deleted{" "}
                            {bucket.deletedAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {confirmId === bucket.id ? (
                          <>
                            <BracketButton
                              variant="destructive"
                              onClick={() => handlePermanentDelete(bucket.id)}
                              disabled={pending}
                            >
                              confirm
                            </BracketButton>
                            <BracketButton onClick={() => setConfirmId(null)} disabled={pending}>
                              cancel
                            </BracketButton>
                          </>
                        ) : (
                          <>
                            <BracketButton
                              onClick={() => handleRestore(bucket.id)}
                              disabled={pending}
                            >
                              restore
                            </BracketButton>
                            <BracketButton
                              variant="destructive"
                              onClick={() => setConfirmId(bucket.id)}
                              disabled={pending}
                            >
                              delete
                            </BracketButton>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
