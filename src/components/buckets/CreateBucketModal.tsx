"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useScrollLock } from "@/hooks/useScrollLock";
import { Button } from "@/components/ui/button";
import { BracketButton } from "@/components/ui/BracketButton";
import { createBucketAction } from "@/app/(app)/actions";
import { Package } from "lucide-react";
import { TEMPLATE_ICONS } from "./constants";
import type { templates } from "@/lib/db/schema";

type TemplateRow = typeof templates.$inferSelect;

interface CreateBucketModalProps {
  templates: TemplateRow[];
}

type Step = "pick" | "name";

const transition: Transition = { duration: 0.15, ease: "easeOut" };

export function CreateBucketModal({ templates }: CreateBucketModalProps) {
  const { createBucketOpen, closeCreateBucket } = useUIStore();
  useScrollLock(createBucketOpen);
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
        closeCreateBucket();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {createBucketOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={closeCreateBucket}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={transition}
            className="bg-background border-border fixed top-[18%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-md border shadow-2xl"
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
                      <p className="font-pixel text-sm">New bucket</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Pick a template to get started.
                      </p>
                    </div>
                    <BracketButton onClick={closeCreateBucket}>
                      <X size={12} />
                    </BracketButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handlePickTemplate(t)}
                        className="border-border bg-card hover:bg-muted flex flex-col gap-1.5 rounded border p-3 text-left transition-colors"
                      >
                        {(() => {
                          const Icon = TEMPLATE_ICONS[t.name] ?? Package;
                          return <Icon size={15} className="text-muted-foreground" />;
                        })()}
                        <span className="font-pixel text-xs">{t.name}</span>
                        {t.description && (
                          <span className="text-muted-foreground line-clamp-2 text-[10px] leading-snug">
                            {t.description}
                          </span>
                        )}
                      </button>
                    ))}
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
                        onClick={() => setStep("pick")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <p className="font-pixel text-sm">Name it</p>
                    </div>
                    <BracketButton onClick={closeCreateBucket}>
                      <X size={12} />
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
                      maxLength={100}
                      disabled={pending}
                      className="border-border bg-input placeholder:text-muted-foreground focus:ring-ring rounded border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
                    />
                    {error && <p className="text-destructive text-xs">{error}</p>}
                    <Button onClick={handleCreate} loading={pending} disabled={!name.trim()}>
                      Create bucket
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
