"use client";

import { ArrowLeft } from "pixelarticons/react/ArrowLeft.js";
import { Close } from "pixelarticons/react/Close.js";
import { Package } from "pixelarticons/react/Package.js";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { useUIStore } from "@/store/ui";
import { Modal, ModalTitle } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { BracketButton } from "@/components/ui/BracketButton";
import { createBucketAction } from "@/app/(app)/actions";
import { TEMPLATE_ICONS } from "./constants";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import type { templates } from "@/lib/db/schema";

type TemplateRow = typeof templates.$inferSelect;

type CreateBucketModalProps = {
  templates: TemplateRow[];
};

type Step = "pick" | "name";

const transition: Transition = { duration: 0.15, ease: "easeOut" };

export function CreateBucketModal({ templates }: CreateBucketModalProps) {
  const { createBucketOpen, closeCreateBucket, selectNewBucket } = useUIStore();
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<TemplateRow | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "name") {
      const id = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [step]);

  function handleExitComplete() {
    setStep("pick");
    setSelected(null);
    setName("");
    setError("");
  }

  function handlePickTemplate(t: TemplateRow) {
    setSelected(t);
    setName(t.name);
    setStep("name");
  }

  function handleCreate() {
    if (!selected) return;
    setError("");
    startTransition(async () => {
      const result = await createBucketAction(selected.id, name);
      if (result.ok) {
        selectNewBucket(result.bucketId);
        closeCreateBucket();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal
      open={createBucketOpen}
      onClose={closeCreateBucket}
      onExitComplete={handleExitComplete}
      className="bg-background border-border top-[18%] overflow-hidden rounded-md border shadow-2xl sm:top-[18%]"
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === "pick" ? (
          <motion.div
            key="pick"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={transition}
          >
            <div className="flex items-start justify-between border-b px-4 py-3">
              <div>
                <ModalTitle className="text-sm">New bucket</ModalTitle>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Pick a template to get started.
                </p>
              </div>
              <BracketButton onClick={closeCreateBucket} aria-label="close">
                <PixelIcon icon={Close} />
              </BracketButton>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {error && <p className="text-destructive px-4 pt-3 font-mono text-xs">{error}</p>}

              <div className="grid grid-cols-2 gap-1.5 p-2 sm:gap-2 sm:p-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTemplate(t)}
                    className="border-border bg-card hover:bg-muted flex flex-col gap-1 rounded border p-2 text-left transition-colors sm:gap-1.5 sm:p-3"
                  >
                    <PixelIcon
                      icon={TEMPLATE_ICONS[t.name] ?? Package}
                      className="text-muted-foreground"
                    />
                    <span className="font-pixel truncate text-xs sm:text-xs">{t.name}</span>
                    {t.description && (
                      <span className="text-muted-foreground line-clamp-2 text-[11px] leading-snug sm:text-xs">
                        {t.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={transition}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStep("pick");
                    setError("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <PixelIcon icon={ArrowLeft} />
                </button>
                <ModalTitle className="text-sm">Name it</ModalTitle>
              </div>
              <BracketButton onClick={closeCreateBucket} aria-label="close">
                <PixelIcon icon={Close} />
              </BracketButton>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) handleCreate();
                }}
                placeholder="Bucket name…"
                maxLength={BUCKET_NAME_MAX_LENGTH}
                disabled={pending}
                className="border-border bg-input placeholder:text-muted-foreground focus:ring-ring rounded border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
              />
              {name.length > 0 && (
                <p
                  className={cn(
                    "mt-0.5 text-right font-mono text-[11px] transition-colors",
                    charCountColor(name.length, BUCKET_NAME_MAX_LENGTH)
                  )}
                >
                  {name.length}/{BUCKET_NAME_MAX_LENGTH}
                </p>
              )}
              {error && <p className="text-destructive text-xs">{error}</p>}
              <Button onClick={handleCreate} loading={pending} disabled={!name.trim()}>
                Create bucket
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
