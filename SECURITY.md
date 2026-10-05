# security policy

heycapy stores people's sign-in sessions, ai keys, smtp passwords and telegram tokens, so I take security reports seriously. thank you for taking the time to send one.

## supported versions

only the latest release gets security fixes. if you self-host, upgrade to the newest version (see "upgrading" in the [README](README.md)).

## reporting a vulnerability

please report it privately. do not open a public issue, pull request or discussion for a vulnerability.

1. open the [security tab](https://github.com/heycapy/heycapy/security) of this repository
2. click **report a vulnerability**
3. tell me what you found, how to reproduce it, the impact, and which version and install you used (docker, `pnpm dev`, or heycapy.xyz)

the report stays private between you and me until a fix is out.

## what to expect

- I will reply within 7 days.
- once I confirm the problem, I will work on a fix and keep you posted.
- when the fix is released, I will publish a security advisory and credit you if you want to be named.

## scope

in scope:

- the code in this repository, run with the default docker setup
- the hosted app at app.heycapy.xyz

particularly interesting: sign-in codes and sessions, stored keys and secrets, the checks that stop hosted servers from reaching private networks (ntfy, smtp, ollama, webhooks), and the signed reminder links.

out of scope:

- a self-hosted install that is misconfigured (weak secrets, no https, an exposed port)
- problems in third-party services heycapy talks to (Resend, Telegram, ntfy, ai providers)
- load, spam or denial of service tests against heycapy.xyz. please don't run them
- the marketing site, which lives in its own repository
