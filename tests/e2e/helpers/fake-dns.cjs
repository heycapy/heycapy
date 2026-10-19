/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload can only use require */
// Preloaded into the E2E server (playwright.config.ts). Saving a webhook resolves its host first,
// so real DNS made those specs depend on the network. The hosts the specs type resolve to a fixed
// public address here; every other name still goes to the real resolver
const dns = require("node:dns");

const PUBLIC_ADDRESS = "203.0.113.10";
const STUBBED_HOSTS = new Set(["discord.com", "hooks.slack.com", "example.com"]);

// Saving an own key checks it in the background; against the real provider that call could land
// in a later test and overwrite its key status. Nothing listens here, so the check fails at once
const CLOSED_ADDRESS = "127.0.0.1";
const AI_HOSTS = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "api.groq.com",
  "generativelanguage.googleapis.com",
]);

function stubbedAddress(hostname) {
  if (STUBBED_HOSTS.has(hostname)) return PUBLIC_ADDRESS;
  if (AI_HOSTS.has(hostname)) return CLOSED_ADDRESS;
  return null;
}

const realPromisesLookup = dns.promises.lookup;
dns.promises.lookup = (hostname, options) => {
  const address = stubbedAddress(hostname);
  if (!address) return realPromisesLookup(hostname, options);
  const answer = { address, family: 4 };
  return Promise.resolve(options && options.all ? [answer] : answer);
};

// fetch (and so every AI SDK) resolves through the callback form
const realLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === "function") return dns.lookup(hostname, {}, options);
  const address = AI_HOSTS.has(hostname) ? CLOSED_ADDRESS : null;
  if (!address) return realLookup(hostname, options, callback);
  if (options && options.all) return process.nextTick(callback, null, [{ address, family: 4 }]);
  process.nextTick(callback, null, address, 4);
};
