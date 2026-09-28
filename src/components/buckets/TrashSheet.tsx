import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  deleteItemForeverAction,
  emptyTrashAction,
  getTrashAction,
  permanentlyDeleteBucketAction,
  restoreDeletedBucketAction,
  restoreItemAction,
} from "@/app/(app)/actions";
import { TRASH_RETENTION_DAYS } from "@/constants";
import type { TrashedBucket, TrashedItem } from "@/lib/items/trash";

type TrashSheetProps = {
  open: boolean;
  onClose: () => void;
};

type ConfirmTarget = `bucket:${number}` | `item:${number}` | "all";

const HINT = "text-muted-foreground/60 font-mono text-[10px]";

function deletedOn(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrashRow({
  title,
  meta,
  confirming,
  pending,
  canRestore = true,
  onRestore,
  onAskDelete,
  onConfirmDelete,
  onCancel,
}: {
  title: ReactNode;
  meta: string;
  confirming: boolean;
  pending: boolean;
  canRestore?: boolean;
  onRestore: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {title}
        <p className={`${HINT} mt-0.5`}>{meta}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {confirming ? (
          <>
            <BracketButton variant="destructive" onClick={onConfirmDelete} disabled={pending}>
              confirm
            </BracketButton>
            <BracketButton onClick={onCancel} disabled={pending}>
              cancel
            </BracketButton>
          </>
        ) : (
          <>
            {canRestore && (
              <BracketButton onClick={onRestore} disabled={pending}>
                restore
              </BracketButton>
            )}
            <BracketButton variant="destructive" onClick={onAskDelete} disabled={pending}>
              delete
            </BracketButton>
          </>
        )}
      </div>
    </div>
  );
}

export function TrashSheet({ open, onClose }: TrashSheetProps) {
  useScrollLock(open);
  const router = useRouter();
  const [bucketRows, setBucketRows] = useState<TrashedBucket[]>([]);
  const [itemRows, setItemRows] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<ConfirmTarget | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setConfirming(null);
      setError("");
      setLoading(true);
      void getTrashAction().then((result) => {
        if (result.ok) {
          setBucketRows(result.buckets);
          setItemRows(result.items);
        }
        setLoading(false);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void) {
    startTransition(async () => {
      setError("");
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "something went wrong");
        return;
      }
      router.refresh();
      onDone();
      setConfirming(null);
    });
  }

  function restoreBucket(bucket: TrashedBucket) {
    run(
      () => restoreDeletedBucketAction(bucket.id),
      () => {
        setBucketRows((prev) => prev.filter((b) => b.id !== bucket.id));
        setItemRows((prev) =>
          prev.map((i) => (i.bucketId === bucket.id ? { ...i, bucketInTrash: false } : i))
        );
      }
    );
  }

  const empty = bucketRows.length === 0 && itemRows.length === 0;

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
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 shadow-[-4px_0_0_var(--border)] sm:w-80"
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">trash</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2">
              <p className={HINT}>deleted forever after {TRASH_RETENTION_DAYS} days in the trash</p>
              {!empty &&
                (confirming === "all" ? (
                  <span className="flex shrink-0 gap-2">
                    <BracketButton
                      variant="destructive"
                      onClick={() =>
                        run(emptyTrashAction, () => {
                          setBucketRows([]);
                          setItemRows([]);
                        })
                      }
                      disabled={pending}
                    >
                      confirm
                    </BracketButton>
                    <BracketButton onClick={() => setConfirming(null)} disabled={pending}>
                      cancel
                    </BracketButton>
                  </span>
                ) : (
                  <BracketButton
                    variant="destructive"
                    onClick={() => setConfirming("all")}
                    disabled={pending}
                    className="shrink-0"
                  >
                    empty trash
                  </BracketButton>
                ))}
            </div>
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
              ) : empty ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  trash is empty
                </p>
              ) : (
                <>
                  {bucketRows.length > 0 && (
                    <section aria-label="buckets" className="divide-border divide-y">
                      <p className={`${HINT} px-4 pt-3`}>buckets</p>
                      {bucketRows.map((bucket) => (
                        <TrashRow
                          key={bucket.id}
                          title={<p className="font-pixel truncate text-xs">{bucket.name}</p>}
                          meta={`${bucket.itemCount} ${bucket.itemCount === 1 ? "item" : "items"} · deleted ${deletedOn(bucket.deletedAt)}`}
                          confirming={confirming === `bucket:${bucket.id}`}
                          pending={pending}
                          onRestore={() => restoreBucket(bucket)}
                          onAskDelete={() => setConfirming(`bucket:${bucket.id}`)}
                          onConfirmDelete={() =>
                            run(
                              () => permanentlyDeleteBucketAction(bucket.id),
                              () => {
                                setBucketRows((prev) => prev.filter((b) => b.id !== bucket.id));
                                setItemRows((prev) => prev.filter((i) => i.bucketId !== bucket.id));
                              }
                            )
                          }
                          onCancel={() => setConfirming(null)}
                        />
                      ))}
                    </section>
                  )}
                  {itemRows.length > 0 && (
                    <section aria-label="items" className="divide-border divide-y">
                      <p className={`${HINT} px-4 pt-3`}>items</p>
                      {itemRows.map((item) => (
                        <TrashRow
                          key={item.id}
                          title={<p className="truncate font-mono text-xs">{item.title}</p>}
                          meta={
                            item.bucketInTrash
                              ? `${item.bucketName} · restore its bucket first`
                              : `${item.bucketName} · deleted ${deletedOn(item.deletedAt)}`
                          }
                          confirming={confirming === `item:${item.id}`}
                          pending={pending}
                          canRestore={!item.bucketInTrash}
                          onRestore={() =>
                            run(
                              () => restoreItemAction(item.id),
                              () => setItemRows((prev) => prev.filter((i) => i.id !== item.id))
                            )
                          }
                          onAskDelete={() => setConfirming(`item:${item.id}`)}
                          onConfirmDelete={() =>
                            run(
                              () => deleteItemForeverAction(item.id),
                              () => setItemRows((prev) => prev.filter((i) => i.id !== item.id))
                            )
                          }
                          onCancel={() => setConfirming(null)}
                        />
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
