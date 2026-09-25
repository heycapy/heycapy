"use client";

import { useEffect, useState, useTransition } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  getUserSettingsAction,
  updateUserSettingsAction,
  setupTelegramAction,
  disconnectTelegramAction,
} from "@/app/(app)/actions";
import { AppearanceTab, NotificationsTab, AITab, PersonalityTab } from "./SettingsTabs";
import type { UserTone, AIProvider, TranscriptionProvider } from "./settings-constants";
import type { userSettings } from "@/lib/db/schema";

type Settings = typeof userSettings.$inferSelect;
type Tab = "appearance" | "notifications" | "ai" | "personality";
type EmailProvider = "smtp" | null;

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  useScrollLock(open);
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
  const [aiCompactThreshold, setAiCompactThreshold] = useState(40);
  const [aiNotifyMessages, setAiNotifyMessages] = useState(true);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider | null>(
    null
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");

  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [emailProvider, setEmailProvider] = useState<EmailProvider>(null);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState("");
  const [notificationsPush, setNotificationsPush] = useState(true);
  const [ntfyUrl, setNtfyUrl] = useState("");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [notificationsTelegram, setNotificationsTelegram] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [telegramBotConfigured, setTelegramBotConfigured] = useState(false);
  const [telegramActionPending, startTelegramTransition] = useTransition();
  const [telegramError, setTelegramError] = useState("");

  function populate(s: Settings) {
    setPersonalityName(s.personalityName);
    setPersonalityTone(s.personalityTone as UserTone);
    setPersonalityEmoji(s.personalityEmoji);
    setPersonalityCustomPrompt(s.personalityCustomPrompt ?? "");
    setAiProvider((s.aiProvider ?? "ollama") as AIProvider);
    setAiApiKey(s.aiApiKey ?? "");
    setAiModel(s.aiModel ?? "");
    setAiOllamaUrl(s.aiOllamaUrl ?? "");
    setAiCompactThreshold(s.aiCompactThreshold ?? 40);
    setAiNotifyMessages(s.aiNotifyMessages ?? true);
    setTimezone(
      s.timezone !== "UTC" ? s.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    setNotificationsEmail(s.notificationsEmail);
    setEmailProvider((s.emailProvider as EmailProvider) ?? null);
    setSmtpHost(s.smtpHost ?? "");
    setSmtpPort(s.smtpPort !== null ? String(s.smtpPort) : "");
    setSmtpUser(s.smtpUser ?? "");
    setSmtpPass(s.smtpPass ?? "");
    setSmtpSecure(s.smtpSecure ?? false);
    setSmtpFrom(s.smtpFrom ?? "");
    setNotificationsPush(s.notificationsPush);
    setNtfyUrl(s.ntfyUrl ?? "");
    setNtfyTopic(s.ntfyTopic ?? "");
    setNotificationsTelegram(s.notificationsTelegram);
    setTelegramChatId(s.telegramChatId ?? null);
    setTranscriptionProvider((s.transcriptionProvider as TranscriptionProvider | null) ?? null);
    setTranscriptionApiKey(s.transcriptionApiKey ?? "");
    setTranscriptionModel(s.transcriptionModel ?? "");
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setTab("appearance");
      setError("");
      setLoaded(false);
      setTelegramBotUsername(null);
      setTelegramBotConfigured(false);
      setTelegramError("");
      getUserSettingsAction().then((result) => {
        if (result.ok) populate(result.settings);
        setLoaded(true);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "notifications") return;
    setupTelegramAction().then((result) => {
      if (result.ok) {
        setTelegramBotConfigured(true);
        setTelegramBotUsername(result.botUsername);
      } else {
        setTelegramBotConfigured(false);
      }
    });
  }, [open, tab]);

  async function handleSetupTelegram() {
    setTelegramError("");
    startTelegramTransition(async () => {
      const result = await setupTelegramAction();
      if (result.ok) {
        setTelegramBotConfigured(true);
        setTelegramBotUsername(result.botUsername);
      } else {
        setTelegramError(result.error);
      }
    });
  }

  async function handleDisconnectTelegram() {
    startTelegramTransition(async () => {
      await disconnectTelegramAction();
      setTelegramChatId(null);
      setNotificationsTelegram(false);
    });
  }

  async function handleRecheckTelegram() {
    startTelegramTransition(async () => {
      const result = await getUserSettingsAction();
      if (result.ok) {
        setTelegramChatId(result.settings.telegramChatId ?? null);
        setNotificationsTelegram(result.settings.notificationsTelegram);
      }
    });
  }

  function handleSave() {
    if (pending) return;
    setError("");
    const parsedPort = smtpPort ? parseInt(smtpPort, 10) : null;
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
        aiCompactThreshold,
        aiNotifyMessages,
        notificationsEmail,
        emailProvider: emailProvider,
        smtpHost: smtpHost || null,
        smtpPort: parsedPort && !isNaN(parsedPort) ? parsedPort : null,
        smtpUser: smtpUser || null,
        smtpPass: smtpPass || null,
        smtpSecure,
        smtpFrom: smtpFrom || null,
        notificationsPush,
        ntfyUrl: ntfyUrl || null,
        ntfyTopic: ntfyTopic || null,
        notificationsTelegram,
        transcriptionProvider: transcriptionProvider || null,
        transcriptionApiKey: transcriptionApiKey || null,
        transcriptionModel: transcriptionModel || null,
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
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 sm:w-80"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">tweaks</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <div className="border-border scrollbar-hide flex overflow-x-auto border-b-2">
              {(["appearance", "notifications", "ai", "personality"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={tabBtn(t)}>
                  {t}
                </button>
              ))}
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
                      emailProvider={emailProvider}
                      setEmailProvider={setEmailProvider}
                      smtpHost={smtpHost}
                      setSmtpHost={setSmtpHost}
                      smtpPort={smtpPort}
                      setSmtpPort={setSmtpPort}
                      smtpUser={smtpUser}
                      setSmtpUser={setSmtpUser}
                      smtpPass={smtpPass}
                      setSmtpPass={setSmtpPass}
                      smtpSecure={smtpSecure}
                      setSmtpSecure={setSmtpSecure}
                      smtpFrom={smtpFrom}
                      setSmtpFrom={setSmtpFrom}
                      notificationsPush={notificationsPush}
                      setNotificationsPush={setNotificationsPush}
                      ntfyUrl={ntfyUrl}
                      setNtfyUrl={setNtfyUrl}
                      ntfyTopic={ntfyTopic}
                      setNtfyTopic={setNtfyTopic}
                      notificationsTelegram={notificationsTelegram}
                      setNotificationsTelegram={setNotificationsTelegram}
                      telegramChatId={telegramChatId}
                      telegramBotUsername={telegramBotUsername}
                      telegramBotConfigured={telegramBotConfigured}
                      onSetupTelegram={handleSetupTelegram}
                      onDisconnectTelegram={handleDisconnectTelegram}
                      onRecheckTelegram={handleRecheckTelegram}
                      telegramActionPending={telegramActionPending}
                      telegramError={telegramError}
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
                      aiCompactThreshold={aiCompactThreshold}
                      setAiCompactThreshold={setAiCompactThreshold}
                      aiNotifyMessages={aiNotifyMessages}
                      setAiNotifyMessages={setAiNotifyMessages}
                      transcriptionProvider={transcriptionProvider}
                      setTranscriptionProvider={setTranscriptionProvider}
                      transcriptionApiKey={transcriptionApiKey}
                      setTranscriptionApiKey={setTranscriptionApiKey}
                      transcriptionModel={transcriptionModel}
                      setTranscriptionModel={setTranscriptionModel}
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
                  {error && <span className="text-destructive font-mono text-[10px]">{error}</span>}
                </>
              )}
            </div>

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
