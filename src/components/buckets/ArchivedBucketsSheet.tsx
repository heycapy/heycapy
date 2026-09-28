import { useEffect, useState, useTransition } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  getArchivedBucketsAction,
  restoreBucketAction,
  deleteBucketAction,
} from "@/app/(app)/actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type ArchivedBucketsSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function ArchivedBucketsSheet({ open, onClose }: ArchivedBucketsSheetProps) {
  useScrollLock(open);
  const router = useRouter();
  const [archived, setArchived] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setConfirmDeleteId(null);
      setLoading(true);
      void getArchivedBucketsAction().then((result) => {
        if (result.ok) setArchived(result.buckets);
        setLoading(false);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  function handleRestore(bucketId: number) {
    startTransition(async () => {
      await restoreBucketAction(bucketId);
      router.refresh();
      setArchived((prev) => prev.filter((b) => b.id !== bucketId));
    });
  }

  function handleDelete(bucketId: number) {
    startTransition(async () => {
      await deleteBucketAction(bucketId);
      router.refresh();
      setArchived((prev) => prev.filter((b) => b.id !== bucketId));
      setConfirmDeleteId(null);
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
              <span className="font-pixel text-xs">archived buckets</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  loading...
                </p>
              ) : archived.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  no archived buckets
                </p>
              ) : (
                <div className="divide-border divide-y">
                  {archived.map((bucket) => (
                    <div key={bucket.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-pixel truncate text-xs">{bucket.name}</p>
                        {bucket.archivedAt && (
                          <p className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">
                            archived{" "}
                            {bucket.archivedAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {confirmDeleteId === bucket.id ? (
                          <>
                            <BracketButton
                              variant="destructive"
                              onClick={() => handleDelete(bucket.id)}
                              disabled={pending}
                            >
                              confirm
                            </BracketButton>
                            <BracketButton
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={pending}
                            >
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
                              onClick={() => setConfirmDeleteId(bucket.id)}
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
