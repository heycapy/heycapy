import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { NTFY_TIMEOUT_MS } from "@/constants";
import { publicAddress } from "./public-address";

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
  const pinned = await publicAddress(url.hostname);
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
  const { status, text } = await post(url, body, pinned && pinnedLookup(pinned));
  if (status < 200 || status >= 300) throw new Error(`ntfy error ${status}: ${text}`);
}

// node asks for a list when it tries ipv4 and ipv6 in turn (autoSelectFamily)
function pinnedLookup(address: { address: string; family: number }): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
}

// not fetch: a pinned lookup needs node's own request, which also never follows redirects
function post(
  url: URL,
  body: string,
  lookup: LookupFunction | null
): Promise<{ status: number; text: string }> {
  const request = url.protocol === "https:" ? https.request : http.request;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: NTFY_TIMEOUT_MS,
        ...(lookup && { lookup }),
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("ntfy server didn't answer in time")));
    req.on("error", reject);
    req.end(body);
  });
}
