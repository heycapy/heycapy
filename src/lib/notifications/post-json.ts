import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { OUTGOING_TIMEOUT_MS } from "@/constants";
import { publicAddress } from "./public-address";

// posts to a user-typed server: on hosted servers only to a public address, never following redirects
export async function postJson(
  url: URL,
  body: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; text: string }> {
  const pinned = await publicAddress(url.hostname);
  return post(url, body, headers, pinned && pinnedLookup(pinned));
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
  headers: Record<string, string>,
  lookup: LookupFunction | null
): Promise<{ status: number; text: string }> {
  const request = url.protocol === "https:" ? https.request : http.request;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: OUTGOING_TIMEOUT_MS,
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
    req.on("timeout", () => req.destroy(new Error(`${url.host} didn't answer in time`)));
    req.on("error", reject);
    req.end(body);
  });
}
