import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList } from "node:net";
import { isHosted } from "@/lib/credits";

const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv4");
}
// fc00::/7 covers fly's private network (fdaa::/16); 64:ff9b:: is nat64, which can reach private ipv4
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv6");
}

// on hosted servers a user-typed host must not reach our own network; returns the checked
// address to connect to, so a name can't resolve differently between the check and the connect
export async function publicAddress(host: string): Promise<LookupAddress | null> {
  if (!isHosted()) return null;
  const name = host.replace(/^\[(.*)\]$/, "$1");
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(name, { all: true });
  } catch {
    throw new Error(`couldn't find ${host}. check the address`);
  }
  if (
    addresses.length === 0 ||
    addresses.some((a) => PRIVATE.check(a.address, a.family === 6 ? "ipv6" : "ipv4"))
  ) {
    throw new Error(`${host} points to a private network. use a public server`);
  }
  return addresses[0];
}
