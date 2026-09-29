import { useEffect, useState, useTransition } from "react";
import {
  getPushSetupAction,
  removePushDeviceAction,
  savePushDeviceAction,
  sendTestNotificationAction,
  type PushDevice,
} from "@/app/(app)/actions";
import { BOX, LABEL, SECTION } from "./settings-constants";
import { TestSendButton } from "./TestSendButton";

type Support = "checking" | "supported" | "iosNeedsInstall" | "unsupported";

const HINT = "text-muted-foreground font-mono text-[11px]";
const ACTION =
  "text-muted-foreground hover:text-foreground font-mono text-[11px] disabled:opacity-40";

function detectSupport(): Support {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    return "supported";
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && !standalone ? "iosNeedsInstall" : "unsupported";
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iPhone"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export function PushSettings({ pending }: { pending: boolean }) {
  const [support, setSupport] = useState<Support>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [working, startWorking] = useTransition();

  async function load() {
    const result = await getPushSetupAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPublicKey(result.publicKey);
    setDevices(result.devices);
  }

  useEffect(() => {
    const detected = detectSupport();
    let cancelled = false;
    void (async () => {
      const endpoint =
        detected === "supported" ? ((await currentSubscription())?.endpoint ?? null) : null;
      if (cancelled) return;
      setSupport(detected);
      setThisEndpoint(endpoint);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const thisDevice = devices.find((d) => d.endpoint === thisEndpoint);

  function handleEnable() {
    setError("");
    startWorking(async () => {
      try {
        if (!publicKey) throw new Error("push isn't ready yet, try again");
        // Safari only shows the prompt when it is asked for straight from the tap
        if ((await Notification.requestPermission()) !== "granted") {
          throw new Error("notifications are blocked — allow them for this site in the browser");
        }
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        // A subscription made with other server keys can't be reused
        await (await registration.pushManager.getSubscription())?.unsubscribe();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        });
        const result = await savePushDeviceAction(subscription.toJSON(), deviceName());
        if (!result.ok) {
          await subscription.unsubscribe();
          throw new Error(result.error);
        }
        setThisEndpoint(subscription.endpoint);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleRemove(device: PushDevice) {
    setError("");
    startWorking(async () => {
      try {
        if (device.endpoint === thisEndpoint) {
          await (await currentSubscription())?.unsubscribe();
          setThisEndpoint(null);
        }
        const result = await removePushDeviceAction(device.id);
        if (!result.ok) setError(result.error);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>push</span>
      <p className={HINT}>notifications on this phone or computer, no extra app needed</p>

      {support === "supported" && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={LABEL}>this device</span>
            <span className={HINT}>{thisDevice ? "on" : "off"}</span>
          </div>
          {thisDevice ? (
            <button
              type="button"
              onClick={() => handleRemove(thisDevice)}
              disabled={working || pending}
              className={ACTION}
            >
              [turn off]
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={working || pending || !publicKey}
              className={ACTION}
            >
              {working ? "[turning on...]" : "[turn on]"}
            </button>
          )}
        </div>
      )}
      {support === "iosNeedsInstall" && (
        <p className={HINT}>
          on iPhone, push works from the home screen app: tap share → add to home screen, then open
          heycapy from there and turn push on
        </p>
      )}
      {support === "unsupported" && (
        <p className={HINT}>this browser can&apos;t show push notifications</p>
      )}

      {devices.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>devices</span>
          <ul className="flex flex-col gap-1">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-2">
                <span className="text-foreground/80 truncate font-mono text-xs">
                  {device.name}
                  {device.endpoint === thisEndpoint && " (this device)"}
                  <span className="text-muted-foreground">
                    {" "}
                    · added{" "}
                    {device.addedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(device)}
                  disabled={working || pending}
                  aria-label={`remove ${device.name}`}
                  className={ACTION}
                >
                  [x]
                </button>
              </li>
            ))}
          </ul>
          <TestSendButton
            disabled={pending || working}
            onSend={() => sendTestNotificationAction("push")}
          />
        </div>
      )}

      {error && <p className="text-destructive font-mono text-[11px]">{error}</p>}
    </div>
  );
}
