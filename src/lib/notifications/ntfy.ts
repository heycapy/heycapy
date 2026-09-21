export async function sendNtfy(
  ntfyUrl: string,
  topic: string,
  title: string,
  message: string
): Promise<void> {
  const base = ntfyUrl.replace(/\/$/, "");
  await fetch(`${base}/${topic}`, {
    method: "POST",
    headers: { Title: title, "Content-Type": "text/plain" },
    body: message,
  });
}
