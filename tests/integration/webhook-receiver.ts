import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export type WebhookReceiver = {
  url: string;
  received: { headers: IncomingHttpHeaders; body: string }[];
  reply: (status: number) => void;
  close: () => Promise<void>;
};

export async function startWebhookReceiver(): Promise<WebhookReceiver> {
  let status = 200;
  const received: WebhookReceiver["received"] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(status).end(status === 200 ? "ok" : "nope");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/hook`,
    received,
    reply: (s) => {
      status = s;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
