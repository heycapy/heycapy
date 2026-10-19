# changelog

all notable changes to heycapy. versions follow [semver](https://semver.org): a patch version (0.3.1) only fixes things, a minor version (0.4.0) adds features. the database migrates itself on start and migrations only go forward, so back up before upgrading (see the README).

## 0.4.0

reminder emails now go out through each person's own email account, and the app gets pixel icons and a what's new list. if your server sends reminders through resend, read upgrading before you update.

### new

- what's new in the ··· menu, with a dot until you open it after an update
- every icon is pixel art (pixelarticons)
- bucket settings → notifications is split into sections (where, when to remind, if it's overdue, reminder buttons) with clearer names
- tweaks → notifications → email links to a setup guide for gmail and other providers

### fixes

- your own smtp on port 465 works. ssl now follows the port: 465 uses ssl, anything else starttls, a blank port means 587
- feedback reports the right app version, it said 0.2.0

### changes

- resend no longer sends reminders. it only sends sign-in codes, admin alerts and feedback. reminder emails use the person's own smtp from tweaks, else the server's SMTP_HOST, else they fail with a message pointing to tweaks
- without their own smtp or SMTP_HOST, email no longer counts as a working channel, so the "no notification channel works" banner shows until another channel is set up

### upgrading

- migration 0037 runs on start. it adds the last seen release to users, existing accounts see the what's new dot once
- if reminders went out through RESEND_API_KEY, set SMTP_HOST (with SMTP_PORT, SMTP_USER, SMTP_PASS) or have each person add their own smtp in tweaks. reminders already queued for people without one fail
- the "use ssl" setting for a person's own smtp is no longer read, the port decides

## 0.3.0

share a bucket with family or friends, and draw the pixel avatar they see next to your name. sharing is in beta. back up the database before upgrading: migration 0034 moves the reminder schedule out of items.

### new

- share a bucket (beta): invite by code, link or qr from bucket settings → members, join from the ··· menu or the /join link. codes are single use and last 48 hours, up to 5 people per bucket
- members can do anything with items, including restoring them from the trash. only the owner changes the bucket, invites and removes people, deletes forever or hands the bucket to another member
- each member picks their own reminder channels for a shared bucket, the rest of its settings are view only for them
- assign an item to a member with the assigned to field or @name in the title. only they are reminded, unassigned items remind everyone
- everyone is reminded on their own clock, channels and quiet hours. all-day items show the same date for everyone, and times show both clocks when people are in different time zones
- open screens update for everyone when someone changes a shared bucket
- telegram, capy, voice, the reminder buttons and the account export work in shared buckets
- usernames for everyone. people only see each other's names, never their emails
- pixel avatars in tweaks → account: draw one on a 16x16 grid or start from one of 12 pictures. anyone who never drew one gets a generated one
- feedback from the ··· menu, shown when RESEND_API_KEY and FEEDBACK_EMAIL are set
- capy's expanded chat keeps its history
- a "new version is out" banner after a deploy
- the sign-in email shows a wikipedia on this day event

### fixes

- an item someone else deleted can no longer be edited while it is open, the dialog says so
- settings refuse a time zone that doesn't exist
- every button and link in tweaks and the bucket dialog uses the theme accent

### upgrading

- migrations 0028–0036 run on start. 0034 moves the reminder schedule out of items, so back up first
- optional: set FEEDBACK_EMAIL to get feedback from the app

## 0.2.0

### new

- hosted servers (HOSTED=true) can sell capy credit packs through dodo payments in a new tweaks → credits tab ($5 = 600 credits, $10 = 1,400). self-hosted servers don't need it
- refunds and lost disputes take the credits back
- tweaks: ai is now the second tab, and every button uses the theme accent

### upgrading

- migration 0027 runs on start

## 0.1.1

### fixes

- capy no longer skips its tools with the rude and funny tone or a custom style. it could say "added ..." without adding anything, then loop on "i stopped here since one message can take at most 5 steps" when you corrected it

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
