# changelog

all notable changes to heycapy. versions follow [semver](https://semver.org): a patch version (0.3.1) only fixes things, a minor version (0.4.0) adds features. the database migrates itself on start and migrations only go forward, so back up before upgrading (see the README).

## 0.7.1

windows keep the page behind them still, escape closes them, and what's new shows the last three releases.

### fixes

- the page behind an open window (what's new, tweaks, bucket settings, an item, search and the rest) scrolled with your finger on iphone and with the mouse wheel elsewhere. it stays still now
- tab stays inside an open window, and closing one puts focus back on the button that opened it
- screen readers announce each window by its name and skip the page behind it while it's open

### changes

- escape closes any window. with a window on top of another (the schema editor over bucket settings) it closes the top one first, and an open picker or @ list closes before its window
- every window is built on one shared modal ([radix dialog](https://www.radix-ui.com/primitives/docs/components/dialog)), so the backdrop is the same shade everywhere
- what's new shows the last three releases, with a link to this changelog for the rest

### upgrading

- no migrations. `docker compose up -d --build` as usual

## 0.7.0

off-site backups: every change to the database goes to an s3-style bucket within a second, and a lost volume comes back from it on its own.

### new

- off-site backups with [litestream](https://litestream.io) (docker): add `LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`, `LITESTREAM_PATH`, `LITESTREAM_ACCESS_KEY_ID` and `LITESTREAM_SECRET_ACCESS_KEY` to `.env` and every change goes to the bucket within a second. works with backblaze b2, cloudflare r2, aws s3 and other s3-style storage. without these lines nothing changes
- a new server with an empty volume restores itself from the bucket on its first start, and the README shows how to go back to a moment in the last day
- litestream 0.5.17 is in the image, checked against its published checksum

### changes

- the image starts with `start.sh` instead of `node server.js`. if you set your own start command (a `command:` in compose, a process in fly.toml), change it to `sh start.sh` or off-site backups never run
- with off-site backups on, an empty volume won't start while the bucket can't be reached, so an empty database never replaces your backup. a volume that has a database starts as usual and catches up once the bucket answers

### upgrading

- no migrations. `docker compose up -d --build` as usual, the nightly copies in `backups/` keep running alongside

## 0.6.1

an open members tab keeps up with renames, and primary text is easier to read in five themes.

### fixes

- bucket settings → members shows a member's new username or avatar while it's open, it showed them only after you opened the tab again
- the primary colour (links, active tabs, "✓ available", buttons) was too faint to read in gruvbox light, rosé pine dawn, rosé pine, solarized and midnight. it's darker or lighter now so it reads on the page, on cards and under button labels. solarized and midnight buttons have dark labels now

## 0.6.0

change your username, see a member's new name and avatar without reloading, and heycapy refuses to start on a database from a newer version instead of serving errors.

### new

- tweaks → account: change your username. type one or press "generate another", it's checked while you type (3 to 32 letters, numbers or _, not taken, not reserved). 2 changes per 30 days,  when none are left the box says when the next one opens. the last monthly change and a bonus change ask first
- a username someone lets go of stays theirs for 30 days, nobody else can take it in that time
- tweaks → system → usernames (admins): find someone by email, rename them, give or take bonus changes, see their last changes. an admin rename uses none of their changes and can take a name that's still held, never one someone has now or a reserved one. shown whether or not HOSTED is set

### fixes

- a member's new username or avatar shows on the others' open screens straight away, it showed only after they reloaded
- the sign-in form no longer moves up while you type a long email

### changes

- display names are gone, everyone is shown by their username (nothing in the app ever set a display name)
- heycapy refuses to start when the database has a migration newer than the code knows, with "the database is newer than this version". running an older version after an upgrade used to start and fail on every request; restore the backup from before the upgrade to go back

### upgrading

- migrations 0039 and 0040 run on start. 0039 drops users.display_name, 0040 adds username_changes (the history of renames) and users.username_bonus_changes. back up before upgrading: after it, 0.5.0 won't start on this database

## 0.5.0

set your notification settings once in tweaks and every bucket can use them. coming back from buying credits says the right thing.

### new

- tweaks → notifications → bucket defaults: channels, reminders, remind at, keep reminding and overdue. buckets that follow them show "from tweaks", changing one in a bucket stops following only that one, "use tweaks" goes back
- new buckets follow the defaults for everything their template leaves out, and take their channels from tweaks. in a shared bucket the owner's defaults set the rules and each member's own set their channels
- capy knows which bucket settings come from tweaks and can switch one back to them
- field names in tweaks and bucket settings stand out from the hint under them

### fixes

- coming back from a successful checkout says the payment was received, it said the payment didn't go through. an expired checkout and a payment still being processed get their own message
- while dodo payments is in test mode (DODO_PAYMENTS_ENVIRONMENT is not live_mode) only admins can buy credits, so a test card never gives anyone free credits

### changes

- an outgoing webhook's "on for new buckets" switch is now "on by default"

### upgrading

- migration 0038 runs on start. it adds the bucket defaults to user settings. buckets and memberships from before don't follow them, so nothing changes until someone picks "use tweaks" in a bucket

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
