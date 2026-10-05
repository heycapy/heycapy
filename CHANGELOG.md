# changelog

all notable changes to heycapy. versions follow [semver](https://semver.org): 0.1.x fixes, 0.2 features. the database migrates itself on start and migrations only go forward, so back up before upgrading (see the README).

## 0.1.0

the first release. you can self-host it with docker.

### what works

- buckets from templates (reminders, subscriptions, todo, work, ci/cd monitor) or blank, with custom fields, sort order, quiet hours and per-bucket channels. archive or delete one and restore it from the trash for 30 days
- items with dates picked out of the title, repeats (daily, weekly, chosen weekdays, last day of the month), up to 4 reminders per item, snooze, swipe to complete
- reminders by email (resend or smtp), web push, ntfy, telegram, discord, slack and webhooks, with retries and a banner when a channel keeps failing. done and remind me later buttons on email, push, ntfy and telegram
- capy, an assistant you type or talk to, using your own key (ollama, openai, anthropic, groq or gemini) or the server's. it adds, moves and completes items and changes bucket settings
- incoming webhook per bucket, up to 3 signed outgoing webhooks per user
- sign in by email code, nightly database backups, full account export, 18 themes
- startup refuses to run with placeholder or malformed secrets and says what to fix

### known limits

- one server and one SQLite database, no clustering. backups stay on the same volume unless you copy them off
- web only: no native phone or desktop apps. push on iphone needs the app added to the home screen
- capy needs an ai (your own key or the server's), and voice needs a groq, openai or gemini key; without them the rest works
- no public api or personal access tokens yet
- no docker image is published yet, compose builds it on your machine
