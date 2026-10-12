/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload can only use require */
// Preloaded into the E2E server (playwright.config.ts). Saving a webhook resolves its host first,
// so real DNS made those specs depend on the network. The hosts the specs type resolve to a fixed
// public address here; every other name still goes to the real resolver
const dns = require("node:dns");

const PUBLIC_ADDRESS = "203.0.113.10";
const STUBBED_HOSTS = new Set(["discord.com", "hooks.slack.com", "example.com"]);

const realLookup = dns.promises.lookup;
dns.promises.lookup = (hostname, options) => {
  if (!STUBBED_HOSTS.has(hostname)) return realLookup(hostname, options);
  const answer = { address: PUBLIC_ADDRESS, family: 4 };
  return Promise.resolve(options && options.all ? [answer] : answer);
};
