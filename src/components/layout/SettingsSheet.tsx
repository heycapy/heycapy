"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { getUserSettingsAction, updateUserSettingsAction, logoutAction } from "@/app/(app)/actions";
import { AppearanceTab, NotificationsTab, AITab, PersonalityTab } from "./SettingsTabs";
import { StatusesTab } from "./StatusesTab";
import type { UserTone, AIProvider } from "./settings-constants";
import type { userSettings } from "@/lib/db/schema";

type Settings = typeof userSettings.$inferSelect;
type Tab = "appearance" | "notifications" | "ai" | "personality" | "statuses";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("appearance");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [personalityName, setPersonalityName] = useState("Capy");
  const [personalityTone, setPersonalityTone] = useState<UserTone>("chill");
  const [personalityEmoji, setPersonalityEmoji] = useState(true);
  const [personalityCustomPrompt, setPersonalityCustomPrompt] = useState("");

  const [aiProvider, setAiProvider] = useState<AIProvider>("ollama");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiOllamaUrl, setAiOllamaUrl] = useState("");

  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationsPush, setNotificationsPush] = useState(true);
  const [ntfyUrl, setNtfyUrl] = useState("");
  const [ntfyTopic, setNtfyTopic] = useState("");

  function populate(s: Settings) {
    setPersonalityName(s.personalityName);
    setPersonalityTone(s.personalityTone as UserTone);
    setPersonalityEmoji(s.personalityEmoji);
    setPersonalityCustomPrompt(s.personalityCustomPrompt ?? "");
    setAiProvider((s.aiProvider ?? "ollama") as AIProvider);
    setAiApiKey(s.aiApiKey ?? "");
    setAiModel(s.aiModel ?? "");
    setAiOllamaUrl(s.aiOllamaUrl ?? "");
    setTimezone(
      s.timezone !== "UTC" ? s.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone
    );
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
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        aiProvider,
        aiApiKey: aiApiKey || null,
        aiModel: aiModel || null,
        aiOllamaUrl: aiOllamaUrl || null,
        notificationsEmail,
        notificationsPush,
        ntfyUrl: ntfyUrl || null,
        ntfyTopic: ntfyTopic || null,
      });
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  const tabBtn = (t: Tab) =>
    cn(
      "font-mono text-[10px] px-1.5 py-1 whitespace-nowrap transition-colors shrink-0",
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
            className="fixed inset-0 z-[55] bg-black"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-80 flex-col border-l-2"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">tweaks</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <div className="border-border scrollbar-hide flex overflow-x-auto border-b-2">
              {(["appearance", "notifications", "ai", "personality", "statuses"] as Tab[]).map(
                (t) => (
                  <button key={t} onClick={() => setTab(t)} className={tabBtn(t)}>
                    {t}
                  </button>
                )
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {!loaded ? (
                <p className="text-muted-foreground font-mono text-xs">loading...</p>
              ) : (
                <>
                  {tab === "appearance" && (
                    <AppearanceTab
                      theme={theme}
                      setTheme={setTheme}
                      timezone={timezone}
                      setTimezone={setTimezone}
                      pending={pending}
                    />
                  )}
                  {tab === "notifications" && (
                    <NotificationsTab
                      notificationsEmail={notificationsEmail}
                      setNotificationsEmail={setNotificationsEmail}
                      notificationsPush={notificationsPush}
                      setNotificationsPush={setNotificationsPush}
                      ntfyUrl={ntfyUrl}
                      setNtfyUrl={setNtfyUrl}
                      ntfyTopic={ntfyTopic}
                      setNtfyTopic={setNtfyTopic}
                      pending={pending}
                    />
                  )}
                  {tab === "ai" && (
                    <AITab
                      aiProvider={aiProvider}
                      setAiProvider={setAiProvider}
                      aiApiKey={aiApiKey}
                      setAiApiKey={setAiApiKey}
                      aiModel={aiModel}
                      setAiModel={setAiModel}
                      aiOllamaUrl={aiOllamaUrl}
                      setAiOllamaUrl={setAiOllamaUrl}
                      pending={pending}
                    />
                  )}
                  {tab === "personality" && (
                    <PersonalityTab
                      personalityName={personalityName}
                      setPersonalityName={setPersonalityName}
                      personalityTone={personalityTone}
                      setPersonalityTone={setPersonalityTone}
                      personalityCustomPrompt={personalityCustomPrompt}
                      setPersonalityCustomPrompt={setPersonalityCustomPrompt}
                      personalityEmoji={personalityEmoji}
                      setPersonalityEmoji={setPersonalityEmoji}
                      pending={pending}
                    />
                  )}
                  {tab === "statuses" && <StatusesTab />}
                  {error && tab !== "statuses" && (
                    <span className="text-destructive font-mono text-[10px]">{error}</span>
                  )}
                </>
              )}
            </div>

            <div className="border-border flex items-center justify-between border-t-2 px-3 py-2.5">
              <BracketButton variant="destructive" onClick={() => void logoutAction()}>
                logout
              </BracketButton>
              {tab !== "statuses" && (
                <BracketButton onClick={handleSave} disabled={pending || !loaded}>
                  save
                </BracketButton>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
