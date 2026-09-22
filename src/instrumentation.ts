async function alertCrash(label: string, err: unknown): Promise<void> {
  const ntfyUrl = process.env.NTFY_URL;
  const ntfyTopic = process.env.NTFY_TOPIC;
  if (!ntfyUrl || !ntfyTopic) return;
  const base = ntfyUrl.replace(/\/$/, "");
  const message = err instanceof Error ? err.message : String(err);
  try {
    await fetch(`${base}/${ntfyTopic}`, {
      method: "POST",
      headers: { Title: "[HeyCapy] process crash", "Content-Type": "text/plain" },
      body: `${label}: ${message}`,
    });
  } catch {}
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();

    process.on("uncaughtException", (err) => {
      void alertCrash("uncaughtException", err);
    });

    process.on("unhandledRejection", (reason) => {
      void alertCrash("unhandledRejection", reason);
    });
  }
}
