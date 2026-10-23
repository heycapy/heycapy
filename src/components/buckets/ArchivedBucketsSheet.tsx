import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader } from "@/components/ui/Modal";
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
    <Modal open={open} onClose={onClose} variant="sheet">
      <ModalHeader title="archived buckets" onClose={onClose} />

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
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
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
                      <BracketButton onClick={() => setConfirmDeleteId(null)} disabled={pending}>
                        cancel
                      </BracketButton>
                    </>
                  ) : (
                    <>
                      <BracketButton onClick={() => handleRestore(bucket.id)} disabled={pending}>
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
    </Modal>
  );
}
