import { postJson } from "./post-json";

export type NtfyExtras = {
  click?: string;
  actions?: { label: string; url: string; body: string }[];
};

// JSON, not headers: emoji in titles and labels can't travel in HTTP headers
export async function sendNtfy(
  ntfyUrl: string,
  topic: string,
  title: string,
  message: string,
  extras: NtfyExtras = {}
): Promise<void> {
  const url = new URL(`${ntfyUrl.replace(/\/$/, "")}/`);
  const body = JSON.stringify({
    topic,
    title,
    message,
    ...(extras.click && { click: extras.click }),
    ...(extras.actions?.length && {
      actions: extras.actions.map((a) => ({
        action: "http",
        label: a.label,
        url: a.url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: a.body,
        clear: true,
      })),
    }),
  });
  const { status, text } = await postJson(url, body);
  if (status < 200 || status >= 300) throw new Error(`ntfy error ${status}: ${text}`);
}
