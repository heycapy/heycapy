export async function sendNtfy(
  ntfyUrl: string,
  topic: string,
  title: string,
  message: string
): Promise<void> {
  const base = ntfyUrl.replace(/\/$/, "");
  const safeTitle = title.replace(/[^\x00-\xFF]/g, "").trim();
  const res = await fetch(`${base}/${topic}`, {
    method: "POST",
    headers: {
      Title: safeTitle,
      "Content-Type": "text/plain",
    },
    body: message,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ntfy error ${res.status}: ${body}`);
  }
}
