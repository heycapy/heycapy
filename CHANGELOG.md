# changelog

all notable changes to heycapy. versions follow [semver](https://semver.org): a patch version (0.3.1) only fixes things, a minor version (0.4.0) adds features. the database migrates itself on start and migrations only go forward, so back up before upgrading (see the README).

## 0.11.2

ticking tells you it's done and lets you undo, the first-run picker also picks your theme, and capy knows which of your buckets are shared.

### new

- ticking an item shows a "done" toast with an undo button. repeating items have no undo, because ticking one moves it to its next date
- the first-run look picker also asks for a theme, with a swatch for each one, so a new account starts the way it wants to look

### changes

- capy's name is fixed. it's always capy now, so the "name" field is gone from tweaks › personality and the "rename capy" task is gone from the getting started guide. the guide has 17 tasks and pays 48 credits in all
- no more lines between items, in buckets, today and search. the list reads as one clean column
- in capy's chat history, delete and load show when you hover a chat. the expanded chat no longer pokes out of its rounded corners

### fixes

- capy and the telegram bot understand shared buckets. they know which buckets are shared and who is in them
- items assigned to someone no longer show an arrow before their avatar
- the members bar has some space under the bucket tabs

### upgrading

- one migration (`0053`) drops the old capy name setting. back up first, as always, then `docker compose up -d --build`

## 0.11.1

a small fix release: reduce motion now does what it says.

### fixes

- the reduce motion switch takes effect the moment you tap it. before, it waited for the server and the settings around it dimmed and blinked
- with reduce motion on, switching buckets swaps the list at once. before, the list jumped, faded and went blank for a moment
- going back to a bucket you've already opened shows its items straight away while they refresh, instead of flashing "loading..." first
- with reduce motion on, drawers and dialogs (bucket settings, capy, the add form, tweaks, new bucket) open and close at once. before, they still faded and flickered
- turning reduce motion on or off no longer makes every done item's tick pop again

### upgrading

- nothing to migrate. `docker compose up -d --build` as usual

## 0.11.0

ticking an item finally feels like something happened, toasts are smaller and stay out of the way, and heycapy gets its first comfort settings: bigger text and reduced motion.

### new

- ticking an item answers the moment you tap: the box pops (the circle in modern, the pixel dot in original), a short sound plays and android phones give a tiny buzz. before, the box waited for the server and nothing seemed to happen
- pick the tick sound in tweaks › appearance: chime (the default), sparkle, success, harp, or off. picking one plays it. "off" turns the buzz off too
- text size in tweaks › appearance: default, large or larger. every text in the app grows, the layout keeps its shape
- reduce motion in tweaks › appearance: no sliding, fading, popping or smooth scrolling anywhere. heycapy also follows your device's own reduce motion setting now
- a failed tick puts the box back and says so, with a retry button

### changes

- done items are no longer crossed out. they keep their text and dim a little, so open items still stand out
- new buckets keep done items in the list by default, whichever template you start from. the todo and ci/cd templates used to hide them. buckets you already have keep their setting
- toasts sit at the bottom centre, just above the add bar, on phones and desktop. on phones they no longer cover the bucket tabs
- toasts are one small line in your theme's colours: an icon, the message and an action like undo or retry. only errors have a ×
- at most three toasts show at once. a fourth closes the oldest, so there's never a pile to clear
- toasts move up above the add form when it's open, and stay centred over the list when the chat or tweaks is docked beside it
- errors are announced to screen readers straight away and stay a little longer. escape closes a toast, alt+t jumps to it
- undo after deleting shows its time left as a thin line under the toast

### upgrading

- one migration (0052) runs on start and adds three settings to `user_settings`: `tick_sound` ("chime"), `reduce_motion` (off) and `text_size` ("default"). back up first, then `docker compose up -d --build` as usual

## 0.10.0

the biggest release heycapy has had. every screen was redrawn: buckets are tabs along the top, items have a tick box, adding and editing happen in one bar at the bottom, capy sits in the header, and there's a second look to pick from. "original" keeps the pixel style heycapy started with. "modern" is clean, rounded and quiet. nothing about your buckets, items or reminders changes, but almost everything about how you move around them does, so take a minute to look around. one status is gone too: "on hold" (see "removed" below).

### a new layout

- buckets are tabs along the top instead of a drawer on the left: search is pinned first, then today, then your buckets, then "+ new". the tabs stay at the top while the list scrolls
- hold a tab and drag it to put your buckets in your own order. the order is yours alone, so people you share a bucket with keep theirs, and every bucket keeps its colour wherever it moves
- bucket settings (⚙) sit on the open tab, and a small mark at the corner of a tab's name tells you something in it is late
- the top row has capy, getting started and what's new, with your avatar on the right. your avatar opens a menu with tweaks, join a bucket, archived, trash, feedback and the rest. the greeting and date that used to sit there are gone
- tweaks, bucket settings, trash, archived, getting started and what's new open in one side panel, one at a time, instead of a different window each. leaving tweaks with unsaved changes asks first
- bucket settings › notifications is split into tabs, so each part fits on one screen
- on desktop the list sits in a column in the middle of the screen. on screens 1280px wide or more, capy's chat opens beside the list instead of over it
- messages ("saved", "deleted" and so on) show at the bottom left on desktop and at the top centre on phones, sized to their text, out of the way of the add bar

### items

- every item has a tick box: tap it to finish the item, tap again to reopen it. it stays grey until it's done, then takes the bucket's colour. it replaces the small status dot and its picker
- long press an item (or right click with a mouse) to open its menu. swiping rows to finish or delete them is gone, the tick box and the menu do both
- titles can run over several lines: enter starts a new line and ctrl/⌘ + enter saves. the list shows up to four lines of each title
- an item you just added is marked for a few seconds so you can spot where it landed
- done items are dimmer, so what's left to do stands out
- items you sort by hand have a six-dot grip to drag them by

### adding and editing

- one bar at the bottom of every list adds items: type a title and press the arrow. capy's chat starts from the same kind of bar, so everything you type into looks and works the same
- each bucket keeps its own unsent draft, even when you switch tabs or close the form. escape clears it, and logging out clears every draft
- the bar grows into the full form when you need more than a title: the expand button inside it on desktop, or the handle above it on phones (tap it or swipe up)
- date, time, repeat, reminders and the rest are chips in the form. tap one to set it, and what you picked shows on a line above the title, with a × to clear it all without losing the title
- editing an item opens in the same place as adding, from a bucket, from today or from search
- you can add from today too: pick which bucket the item goes into right in the bar
- on phones, adding and editing open in a drawer from the bottom: drag it down or tap outside to close it
- the send arrow only shows while you're typing, so an empty bar stays clean

### two looks

- tweaks › appearance › look switches between "original" and "modern". it changes how everything looks, never where anything is, so switching back and forth is safe
- original is heycapy as you know it: pixel icons, a square pixel tick box, [bracketed] buttons, framed lists and a bar along the bottom
- modern has line icons, a round tick box, plain buttons, switches instead of on / off buttons, pill shaped tabs, rounded corners, lists without a frame and an add bar that floats above the list
- in modern, "button size" (small, medium or large) sets how big buttons, tabs and inputs are. medium is a comfortable tap on phones and tighter on desktop
- your look is saved to your account, so it follows you to every device and browser you sign in on
- the first time you open the app after upgrading, a small window asks which look you want, with a live preview of each. you can change your mind any time in tweaks
- every theme works with both looks, and tooltips follow your theme too

### capy

- capy has a button in the header. on wide screens the chat docks beside your list, on phones it opens as a drawer from the bottom, and in between it floats above the list
- a link capy gives you to an item opens that item right where you are
- clicking the chat's header no longer folds it away by accident, only the − button does
- capy can't put items on hold any more. ask it to pause something and it offers a later date, or tells you about "remind again" on the reminder

### removed

- the "on hold" status. a later date or "remind again" on a reminder does the same job. every item that was on hold becomes active when you upgrade, and its reminders start again. one whose date has already passed gets its overdue alert soon after
- webhooks that still send `"status": "on hold"` keep working: it's treated as active. any other unknown status is still refused
- sharing leaves beta: its "beta" tags are gone

### fixes

- red text (late items, errors, delete buttons) is readable in every theme. it was too faint in 13 of them, and now passes the contrast guideline (4.5:1) on the page, on cards and inside the late chip, with each theme's own shade kept
- the login page sends the email that's in the box, even if you typed it before the page finished loading
- an item can't be saved with a status that doesn't exist

### upgrading

- five migrations (0047 to 0051) run on start:
  - 0047 turns every "on hold" item into an active one. reminders for them are scheduled when the server starts, so an item whose date has passed sends its overdue alert then
  - 0048 adds your own order of bucket tabs (`bucket_members.sort_order`)
  - 0049 adds your look (`user_settings.look`, "original" for everyone)
  - 0050 adds the button size used by the modern look (`user_settings.control_size`, "medium")
  - 0051 marks whether you've picked a look (`users.look_picked`). every existing account sees the look picker once
- if a script or service you point at the webhook relies on "on hold", switch it to a date or a status that exists
- back up first, then `docker compose up -d --build` as usual

## 0.9.0

items show when they're due at a glance, shared buckets show who does what, and the item menu does more in one click.

### new

- a "when" column on the left of every item: "3d late" in red, "today" with the time, "tomorrow" or "in 4d" with the weekday, the full date when the list is wide, "—" for undated items. it's hidden when nothing in the list has a date
- shared buckets get a bar above the list: "N people" opens the members, and all / mine / one person shows only their items (faces on phones)
- done items in a shared bucket say who ticked them ("ticked by sam"), from the web, telegram, a reminder's quick action or capy
- the item menu assigns in one tap: faces of the members (four, then "+n more"), tap again to unassign, and the menu stays open
- "reminders" in the item menu shows the next one, a failed send, or that no channel works, and opens the history in place
- on phones, swipe the bucket button in the bottom bar to go to the next or previous place (today first). dots under the name show where you are
- capy can create a bucket with custom fields, and change the fields of a bucket you own. fields it removes keep their values on items, hidden, and come back if the field does

### changes

- due colours come from your theme, no more fixed orange and yellow
- "→ you" on your items in plain text, other people's muted, and face only on narrow lists. unassigned items in a shared bucket say "anyone"
- the item's #id left the row, and the ··· shows when you hover with a mouse
- the bell on each row is gone. a red ⚠ shows only when a reminder failed to send
- swiping a row to finish or delete it is touch only, a mouse drag does nothing
- the date, people and reminders screens of the item menu keep its header and width, with back at the top left
- on desktop the list, header and banners sit in the middle of the screen instead of stretching to the edges
- the schema editor refuses two fields with the same key and choice fields without options

### fixes

- the status picker opens under the status dot instead of away from it

### upgrading

- one migration (0046) runs on start and adds who completed an item (`items.completed_by`). items done before the upgrade don't name anyone. back up first, then `docker compose up -d --build` as usual

## 0.8.2

a small fix release: today and search show who an item is for, and the health check stops naming server details.

### fixes

- today and search show who an item in a shared bucket is for ("→ sam", "→ you"), like the bucket's own list
- `/api/health` no longer puts a database error in its public answer. it says `{"status": "error"}` with a 503, and the reason goes to the server log and the admin errors list
- deleting an app under tweaks › notifications › other apps no longer closes another one you opened while it was deleting

### upgrading

- one migration (0045) runs on start and drops an email setting that hasn't been used since 0.4.0 (`smtp_secure`, the port decides it). your email settings stay as they are. back up first, then `docker compose up -d --build` as usual

## 0.8.1

capy gets things right more often, items can be done and reassigned from more places, and the guide opens by itself for someone new.

### fixes

- capy sees each bucket's own fields, fills the required ones and keeps values like an amount out of the title. a field it doesn't know is refused, with the real ones named
- name several things in one message ("netflix, hotstar and prime") and capy adds each one. when a single value would have to cover all of them, it asks instead of guessing
- capy remembers what its tools already did earlier in a chat, so a follow-up doesn't add the same item twice
- capy asks before deleting an item, like it already did for buckets
- on a server without an address (`APP_URL`) capy no longer writes links that go nowhere, and in web chat only links into the app are clickable
- an item edited from today or search can have who it's for changed in a shared bucket. adding from today clears it when you switch buckets
- a bucket's telegram settings use the same buttons and toggles as the rest of the app
- the text in an item's field boxes (like "amount: ₹499") sat near the top of its box. it's in the middle now, whatever font your system uses
- a new account opens on the getting started guide, once. accounts from before don't get it

### changes

- done and reopen at the top of an item's menu (right click, long press or the ··· on the item), easier than the small status dot on desktop
- capy's replies in web chat show lists, bold and code
- capy knows when each item was added and can sort oldest or newest first, and links to an item in the app when the server has an address
- the app asks search engines not to list its pages (`noindex`), so a search finds heycapy.xyz instead of a login page. this applies to a self-hosted server too

### upgrading

- two migrations (0043, 0044) run on start: a column that keeps what capy's tools did in each chat message, and one that marks whether the guide has opened (existing accounts count as opened). back up first, then `docker compose up -d --build` as usual

## 0.8.0

a getting started guide: 18 small things to try, each ticks itself once done, and on heycapy.xyz each one pays capy credits.

### new

- "guide" in the header (a map icon on phones) and "getting started" in the ··· menu open a list of things to try: add a reminder, give it a date, make it repeat, invite someone to a bucket, rename capy, change capy's personality, turn on push, connect telegram or ntfy, send a test email from your own account and more
- each task ticks itself once it's done, wherever you did it: the web, telegram or capy. "hint" on any task takes you to where it's done
- "hide from header" takes the button away, the guide stays in the ··· menu
- a new account starts with a "reminders" bucket and opens on it
- push is left out of the list on a server without https, since browsers only allow push there, and telegram is left out without a bot token

### changes

- heycapy.xyz only: new accounts get 15 free capy credits instead of 50, and the guide pays 2 to 5 credits per task, 50 in all, once per account. accounts from before get the 50 too. a self-hosted server keeps no credits, so nothing changes there

### upgrading

- two migrations (0041, 0042) run on start: a table of finished guide tasks and a column for hiding the guide button. back up first, then `docker compose up -d --build` as usual
- tasks someone already did before upgrading tick on their next visit

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
