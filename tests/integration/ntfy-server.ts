import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type NtfyServer = {
  url: string;
  bodies: unknown[];
  reply: (status: number, text: string) => void;
  close: () => Promise<void>;
};

export async function startNtfyServer(): Promise<NtfyServer> {
  let status = 200;
  let text = "{}";
  const bodies: unknown[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (raw += chunk));
    req.on("end", () => {
      bodies.push(JSON.parse(raw));
      res.writeHead(status).end(text);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    bodies,
    reply: (s, t) => {
      status = s;
      text = t;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
