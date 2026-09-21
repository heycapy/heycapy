"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { getUserSettingsAction, updateUserSettingsAction } from "@/app/(app)/actions";
import type { userSettings } from "@/lib/db/schema";

type Settings = typeof userSettings.$inferSelect;
type Tab = "appearance" | "notifications" | "ai" | "personality";
type Tone = "chill" | "professional" | "motivational" | "custom";
type Provider = "ollama" | "openai" | "anthropic";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

const LABEL = "text-muted-foreground font-mono text-[10px]";
const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

const THEMES = [
  { id: "capy", label: "capy", bg: "#fdf6e3", fg: "#7c4b2a" },
  { id: "gruvbox", label: "gruvbox", bg: "#282828", fg: "#d79921" },
  { id: "terminal", label: "terminal", bg: "#000000", fg: "#00ff41" },
] as const;

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "chill", label: "chill" },
  { value: "professional", label: "professional" },
  { value: "motivational", label: "motivational" },
  { value: "custom", label: "custom" },
];

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: "ollama", label: "ollama" },
  { value: "openai", label: "openai" },
  { value: "anthropic", label: "anthropic" },
];

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      <OptionButton active={value} onClick={() => onChange(true)} disabled={disabled}>
        on
      </OptionButton>
      <OptionButton active={!value} onClick={() => onChange(false)} disabled={disabled}>
        off
      </OptionButton>
    </div>
  );
}

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <OptionButton
          key={opt.value}
          active={value === opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </OptionButton>
      ))}
    </div>
  );
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("appearance");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [personalityName, setPersonalityName] = useState("Capy");
  const [personalityTone, setPersonalityTone] = useState<Tone>("chill");
  const [personalityEmoji, setPersonalityEmoji] = useState(true);
  const [personalityCustomPrompt, setPersonalityCustomPrompt] = useState("");

  const [aiProvider, setAiProvider] = useState<Provider>("ollama");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");

  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationsPush, setNotificationsPush] = useState(true);
  const [ntfyUrl, setNtfyUrl] = useState("");
  const [ntfyTopic, setNtfyTopic] = useState("");

  function populate(s: Settings) {
    setPersonalityName(s.personalityName);
    setPersonalityTone(s.personalityTone as Tone);
    setPersonalityEmoji(s.personalityEmoji);
    setPersonalityCustomPrompt(s.personalityCustomPrompt ?? "");
    setAiProvider((s.aiProvider ?? "ollama") as Provider);
    setAiApiKey(s.aiApiKey ?? "");
    setAiModel(s.aiModel ?? "");
    setNotificationsEmail(s.notificationsEmail);
    setNotificationsPush(s.notificationsPush);
    setNtfyUrl(s.ntfyUrl ?? "");
    setNtfyTopic(s.ntfyTopic ?? "");
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setTab("appearance");
      setError("");
      setLoaded(false);
      getUserSettingsAction().then((result) => {
        if (result.ok) populate(result.settings);
        setLoaded(true);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  function handleSave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await updateUserSettingsAction({
        personalityName,
        personalityTone,
        personalityEmoji,
        personalityCustomPrompt: personalityCustomPrompt || null,
        aiProvider,
        aiApiKey: aiApiKey || null,
        aiModel: aiModel || null,
        notificationsEmail,
        notificationsPush,
        ntfyUrl: ntfyUrl || null,
        ntfyTopic: ntfyTopic || null,
      });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const tabBtn = (t: Tab) =>
    cn(
      "font-mono text-[10px] px-2 py-1 transition-colors",
      tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
    );

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
            className="fixed inset-0 z-40 bg-black"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-50 flex h-full w-80 flex-col border-l-2"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            {/* title bar */}
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">settings</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            {/* tabs */}
            <div className="border-border flex border-b-2">
              {(["appearance", "notifications", "ai", "personality"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={tabBtn(t)}>
                  {t}
                </button>
              ))}
            </div>

            {/* content */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {!loaded ? (
                <p className="text-muted-foreground font-mono text-xs">loading...</p>
              ) : (
                <>
                  {tab === "appearance" && (
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>theme</label>
                      <div className="flex gap-2">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className="flex flex-1 flex-col items-center gap-1.5"
                          >
                            <span
                              className="border-border h-10 w-full border-2 transition-all"
                              style={{
                                background: t.bg,
                                borderColor: theme === t.id ? t.fg : undefined,
                                boxShadow: theme === t.id ? `2px 2px 0 ${t.fg}` : undefined,
                              }}
                            />
                            <span
                              className={cn(
                                "font-mono text-[10px]",
                                theme === t.id ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {t.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === "notifications" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>email notifications</label>
                        <Toggle
                          value={notificationsEmail}
                          onChange={setNotificationsEmail}
                          disabled={pending}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>push notifications</label>
                        <Toggle
                          value={notificationsPush}
                          onChange={setNotificationsPush}
                          disabled={pending}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>ntfy server url</label>
                        <input
                          type="text"
                          value={ntfyUrl}
                          onChange={(e) => setNtfyUrl(e.target.value)}
                          placeholder="https://ntfy.sh"
                          disabled={pending}
                          className={INPUT}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>ntfy topic</label>
                        <input
                          type="text"
                          value={ntfyTopic}
                          onChange={(e) => setNtfyTopic(e.target.value)}
                          placeholder="my-topic"
                          disabled={pending}
                          className={INPUT}
                        />
                      </div>
                    </>
                  )}

                  {tab === "ai" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>provider</label>
                        <OptionGroup
                          options={PROVIDER_OPTIONS}
                          value={aiProvider}
                          onChange={setAiProvider}
                          disabled={pending}
                        />
                      </div>
                      {aiProvider !== "ollama" && (
                        <div className="flex flex-col gap-1.5">
                          <label className={LABEL}>api key</label>
                          <input
                            type="password"
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            placeholder="sk-..."
                            disabled={pending}
                            className={INPUT}
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>model</label>
                        <input
                          type="text"
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          placeholder={
                            aiProvider === "ollama"
                              ? "llama3.2"
                              : aiProvider === "openai"
                                ? "gpt-4o"
                                : "claude-sonnet-4-6"
                          }
                          disabled={pending}
                          className={INPUT}
                        />
                      </div>
                      {aiProvider === "ollama" && (
                        <p className="text-muted-foreground font-mono text-[10px]">
                          ollama url is configured via the OLLAMA_URL env var
                        </p>
                      )}
                    </>
                  )}

                  {tab === "personality" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>name</label>
                        <input
                          type="text"
                          value={personalityName}
                          onChange={(e) => setPersonalityName(e.target.value)}
                          placeholder="Capy"
                          disabled={pending}
                          className={INPUT}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>tone</label>
                        <OptionGroup
                          options={TONE_OPTIONS}
                          value={personalityTone}
                          onChange={setPersonalityTone}
                          disabled={pending}
                        />
                      </div>
                      {personalityTone === "custom" && (
                        <div className="flex flex-col gap-1.5">
                          <label className={LABEL}>custom prompt</label>
                          <textarea
                            value={personalityCustomPrompt}
                            onChange={(e) => setPersonalityCustomPrompt(e.target.value)}
                            placeholder="Describe the tone and style..."
                            disabled={pending}
                            rows={4}
                            className="border-border placeholder:text-muted-foreground/50 focus:border-foreground w-full resize-none border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50"
                          />
                          e{" "}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>use emoji</label>
                        <Toggle
                          value={personalityEmoji}
                          onChange={setPersonalityEmoji}
                          disabled={pending}
                        />
                      </div>
                    </>
                  )}

                  {error && <span className="text-destructive font-mono text-[10px]">{error}</span>}
                </>
              )}
            </div>

            {/* footer */}
            <div className="border-border flex items-center justify-end border-t-2 px-3 py-2.5">
              <BracketButton onClick={handleSave} disabled={pending || !loaded}>
                save
              </BracketButton>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
