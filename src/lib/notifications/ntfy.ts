export async function sendNtfy(
  ntfyUrl: string,
  topic: string,
  title: string,
  message: string
): Promise<void> {
  const base = ntfyUrl.replace(/\/$/, "");
  const safeTitle = title.replace(/[^\x00-\xFF]/g, "").trim();
  await fetch(`${base}/${topic}`, {
    method: "POST",
    headers: {
      Title: safeTitle,
      "Content-Type": "text/plain",
    },
    body: message,
  });
}
