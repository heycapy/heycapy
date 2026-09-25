"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { ArrowLeft, Trash2, Upload, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useScrollLock } from "@/hooks/useScrollLock";
import { Button } from "@/components/ui/button";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  createBucketAction,
  importBucketFromCapyAction,
  deleteUserTemplateAction,
} from "@/app/(app)/actions";
import type { CapyFile } from "@/app/(app)/bucket-actions";
import { Package } from "lucide-react";
import { TEMPLATE_ICONS } from "./constants";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
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
  const [importData, setImportData] = useState<CapyFile | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builtinTemplates = templates.filter((t) => t.userId === null);
  const userTemplates = templates.filter((t) => t.userId !== null);

  useEffect(() => {
    if (step === "name") {
      const id = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [step]);

  function handleExitComplete() {
    setStep("pick");
    setSelected(null);
    setImportData(null);
    setName("");
    setError("");
    setDeletingId(null);
  }

  function handlePickTemplate(t: TemplateRow) {
    setSelected(t);
    setImportData(null);
    setName(t.name);
    setStep("name");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as CapyFile;
        if (parsed.version !== 1) {
          setError("Invalid .capy file format.");
          return;
        }
        setImportData(parsed);
        setSelected(null);
        setName(parsed.name ?? "");
        setStep("name");
      } catch {
        setError("Could not read file. Make sure it is a valid .capy file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCreate() {
    setError("");
    startTransition(async () => {
      let result: { ok: true } | { ok: false; error: string };
      if (importData) {
        result = await importBucketFromCapyAction(importData, name);
      } else if (selected) {
        result = await createBucketAction(selected.id, name);
      } else {
        return;
      }
      if (result.ok) {
        closeCreateBucket();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDeleteUserTemplate(e: React.MouseEvent, templateId: number) {
    e.stopPropagation();
    setDeletingId(templateId);
    startTransition(async () => {
      await deleteUserTemplateAction(templateId);
      setDeletingId(null);
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

                  <div className="max-h-[55vh] overflow-y-auto">
                    {error && (
                      <p className="text-destructive px-4 pt-3 font-mono text-[10px]">{error}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 p-3">
                      {builtinTemplates.map((t) => (
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

                    {userTemplates.length > 0 && (
                      <>
                        <div className="border-border border-t px-4 py-2">
                          <p className="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
                            my templates
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 px-3 pb-3">
                          {userTemplates.map((t) => (
                            <div key={t.id} className="flex items-center gap-2">
                              <button
                                onClick={() => handlePickTemplate(t)}
                                disabled={pending && deletingId === t.id}
                                className="border-border bg-card hover:bg-muted flex flex-1 items-center gap-2 rounded border px-3 py-2 text-left transition-colors disabled:opacity-50"
                              >
                                <Package size={12} className="text-muted-foreground shrink-0" />
                                <span className="font-pixel text-xs">{t.name}</span>
                              </button>
                              <button
                                onClick={(e) => handleDeleteUserTemplate(e, t.id)}
                                disabled={pending}
                                className="text-muted-foreground hover:text-destructive shrink-0 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-border flex justify-end border-t px-3 py-2">
                    <button
                      onClick={handleImportClick}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-mono text-[10px] transition-colors"
                    >
                      <Upload size={11} />
                      import .capy
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".capy,.json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
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
                        <ArrowLeft size={14} />
                      </button>
                      <p className="font-pixel text-sm">
                        {importData ? "Import bucket" : "Name it"}
                      </p>
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
                      maxLength={BUCKET_NAME_MAX_LENGTH}
                      disabled={pending}
                      className="border-border bg-input placeholder:text-muted-foreground focus:ring-ring rounded border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
                    />
                    {name.length > 0 && (
                      <p
                        className={cn(
                          "mt-0.5 text-right font-mono text-[9px] transition-colors",
                          charCountColor(name.length, BUCKET_NAME_MAX_LENGTH)
                        )}
                      >
                        {name.length}/{BUCKET_NAME_MAX_LENGTH}
                      </p>
                    )}
                    {error && <p className="text-destructive text-xs">{error}</p>}
                    <Button onClick={handleCreate} loading={pending} disabled={!name.trim()}>
                      {importData ? "Import bucket" : "Create bucket"}
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
