import { useEffect, useState, useTransition } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  checkAIKeyAction,
  getUserSettingsAction,
  updateUserSettingsAction,
  disconnectTelegramAction,
} from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import { AppearanceTab, NotificationsTab, AITab, PersonalityTab } from "./SettingsTabs";
import { AccountTab } from "./AccountTab";
import { SystemTab } from "./SystemTab";
import { useAISettings } from "./useAISettings";
import type { QuietHours } from "./QuietHoursSettings";
import { CloseWarning, SaveBar, useUnsavedChanges } from "./UnsavedChanges";
import { DEFAULT_QUIET_FROM, DEFAULT_QUIET_TO, type UserTone } from "./settings-constants";
import type { userSettings } from "@/lib/db/schema";

type Settings = typeof userSettings.$inferSelect;
export type SettingsTab =
  "appearance" | "notifications" | "ai" | "personality" | "account" | "system";

type SettingsSheetProps = {
  open: boolean;
  initialTab: SettingsTab;
  onClose: () => void;
};

export function SettingsSheet({ open, initialTab, onClose }: SettingsSheetProps) {
  useScrollLock(open);
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [pending, startTransition] = useTransition();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [personalityName, setPersonalityName] = useState("Capy");
  const [personalityTone, setPersonalityTone] = useState<UserTone>("chill");
  const [personalityEmoji, setPersonalityEmoji] = useState(true);
  const [personalityCustomPrompt, setPersonalityCustomPrompt] = useState("");

  const ai = useAISettings();
  const populateAI = ai.populate;

  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationEmailTo, setNotificationEmailTo] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminUser, setAdminUser] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPassSaved, setSmtpPassSaved] = useState(false);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [notificationsPush, setNotificationsPush] = useState(true);
  const [ntfyUrl, setNtfyUrl] = useState("");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [notificationsTelegram, setNotificationsTelegram] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [telegramBotConfigured, setTelegramBotConfigured] = useState(false);
  const [telegramActionPending, startTelegramTransition] = useTransition();
  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: false,
    from: DEFAULT_QUIET_FROM,
    to: DEFAULT_QUIET_TO,
  });
  const [reloads, setReloads] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const [confirmClose, setConfirmClose] = useState(false);
  const unsaved = useUnsavedChanges(loaded ? JSON.stringify(formValues()) : null);
  const resetUnsaved = unsaved.reset;

  function populate(s: Settings) {
    setPersonalityName(s.personalityName);
    setPersonalityTone(s.personalityTone as UserTone);
    setPersonalityEmoji(s.personalityEmoji);
    setPersonalityCustomPrompt(s.personalityCustomPrompt ?? "");
    setTimezone(
      s.timezone !== "UTC" ? s.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    setNotificationsEmail(s.notificationsEmail);
    setNotificationEmailTo(s.notificationEmailTo ?? "");
    setSmtpHost(s.smtpHost ?? "");
    setSmtpPort(s.smtpPort !== null ? String(s.smtpPort) : "");
    setSmtpUser(s.smtpUser ?? "");
    setSmtpPass(""); // write-only — never populated from server
    setSmtpSecure(s.smtpSecure ?? false);
    setNotificationsPush(s.notificationsPush);
    setNtfyUrl(s.ntfyUrl ?? "");
    setNtfyTopic(s.ntfyTopic ?? "");
    setNotificationsTelegram(s.notificationsTelegram);
    setTelegramChatId(s.telegramChatId ?? null);
    setQuietHours({
      enabled: s.quietHoursFrom !== null,
      from: s.quietHoursFrom ?? DEFAULT_QUIET_FROM,
      to: s.quietHoursTo ?? DEFAULT_QUIET_TO,
    });
  }

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(initialTab);
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setError("");
      setLoaded(false);
      resetUnsaved();
      setConfirmClose(false);
      setTelegramBotConfigured(false);
      getUserSettingsAction().then((result) => {
        if (result.ok) {
          populate(result.settings);
          populateAI(result.settings, result.hosted, result.aiKeys, result.transcriptionKey);
          setUserEmail(result.userEmail);
          setAdminUser(result.isAdmin);
          setSmtpPassSaved(result.smtpPassSaved);
          setTelegramBotConfigured(result.telegramBotConfigured);
          if (!result.settings.notificationEmailTo) {
            setNotificationEmailTo(result.userEmail);
          }
        }
        setLoaded(true);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open, populateAI, reloads, resetUnsaved]);

  async function handleDisconnectTelegram() {
    startTelegramTransition(async () => {
      await disconnectTelegramAction();
      setTelegramChatId(null);
      setNotificationsTelegram(false);
      unsaved.keepSaved({ notificationsTelegram: false });
    });
  }

  async function handleRecheckTelegram() {
    startTelegramTransition(async () => {
      const result = await getUserSettingsAction();
      if (result.ok) {
        setTelegramChatId(result.settings.telegramChatId ?? null);
        setNotificationsTelegram(result.settings.notificationsTelegram);
        unsaved.keepSaved({ notificationsTelegram: result.settings.notificationsTelegram });
      }
    });
  }

  function formValues() {
    const parsedPort = smtpPort ? parseInt(smtpPort, 10) : null;
    return {
      personalityName,
      personalityTone,
      personalityEmoji,
      personalityCustomPrompt: personalityCustomPrompt || null,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...ai.payload(),
      notificationsEmail,
      notificationEmailTo: notificationEmailTo || null,
      emailProvider: smtpHost ? "smtp" : null,
      smtpHost: smtpHost || null,
      smtpPort: parsedPort && !isNaN(parsedPort) ? parsedPort : null,
      smtpUser: smtpUser || null,
      smtpPass: smtpPass || null,
      smtpSecure,
      smtpFrom: smtpUser || null,
      notificationsPush,
      ntfyUrl: ntfyUrl || null,
      ntfyTopic: ntfyTopic || null,
      notificationsTelegram,
      quietHoursFrom: quietHours.enabled ? quietHours.from : null,
      quietHoursTo: quietHours.enabled ? quietHours.to : null,
    };
  }

  function requestClose() {
    if (unsaved.dirty) setConfirmClose(true);
    else onClose();
  }

  function discard() {
    setReloads((n) => n + 1);
  }

  function handleSave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await updateUserSettingsAction(formValues());
      if (!result.ok) {
        setError(result.error);
        setConfirmClose(false);
        return;
      }
      if (result.aiChanged) void checkAIKeyAction().then(tickAiRefresh);
      onClose();
    });
  }

  const tabBtn = (t: SettingsTab) =>
    cn(
      "font-mono text-xs px-2 py-1.5 whitespace-nowrap transition-colors shrink-0",
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
            onClick={requestClose}
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
              <BracketButton variant="inverted" onClick={requestClose}>
                x
              </BracketButton>
            </div>

            <div className="border-border flex flex-wrap gap-0.5 border-b px-2 py-1">
              {(
                [
                  "appearance",
                  "notifications",
                  "ai",
                  "personality",
                  "account",
                  ...(adminUser ? ["system"] : []),
                ] as SettingsTab[]
              ).map((t) => (
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
                      notificationEmailTo={notificationEmailTo}
                      setNotificationEmailTo={setNotificationEmailTo}
                      userEmail={userEmail}
                      smtpHost={smtpHost}
                      setSmtpHost={setSmtpHost}
                      smtpPort={smtpPort}
                      setSmtpPort={setSmtpPort}
                      smtpUser={smtpUser}
                      setSmtpUser={setSmtpUser}
                      smtpPass={smtpPass}
                      setSmtpPass={setSmtpPass}
                      smtpPassSaved={smtpPassSaved}
                      smtpSecure={smtpSecure}
                      notificationsPush={notificationsPush}
                      setNotificationsPush={setNotificationsPush}
                      ntfyUrl={ntfyUrl}
                      setNtfyUrl={setNtfyUrl}
                      ntfyTopic={ntfyTopic}
                      setNtfyTopic={setNtfyTopic}
                      notificationsTelegram={notificationsTelegram}
                      setNotificationsTelegram={setNotificationsTelegram}
                      telegramChatId={telegramChatId}
                      telegramBotConfigured={telegramBotConfigured}
                      onDisconnectTelegram={handleDisconnectTelegram}
                      onRecheckTelegram={handleRecheckTelegram}
                      telegramActionPending={telegramActionPending}
                      quietHours={quietHours}
                      setQuietHours={setQuietHours}
                      pending={pending}
                    />
                  )}
                  {tab === "ai" && <AITab ai={ai} pending={pending} />}
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
                  {tab === "account" && <AccountTab email={userEmail} />}
                  {tab === "system" && adminUser && <SystemTab />}
                  {error && <span className="text-destructive font-mono text-xs">{error}</span>}
                </>
              )}
            </div>
            {unsaved.dirty && <SaveBar pending={pending} onSave={handleSave} onDiscard={discard} />}
            {confirmClose && (
              <CloseWarning
                pending={pending}
                onSave={handleSave}
                onDiscard={onClose}
                onKeepEditing={() => setConfirmClose(false)}
              />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
