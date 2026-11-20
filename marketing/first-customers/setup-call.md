# R8: Setup-call checklist

**Audience:** the owner, on a 15-minute call with one of the first 50 customers. **Message to
them:** "Set up in about 10 minutes, or we do it with you on a call." **Outcome:** paid and set up
on the call; the site's setting entered (it can take a few hours to show); first page live within
a week of setup (D2, lifted 2026-11-20; D3's gate).

Checked against the real flow on 2026-11-15: `src/app/(account)/setup/**` and
`src/lib/presentation/copy/keys/setup.ts`. Quoted words are what the customer sees on screen.

## Owner to do

- [ ] Run this checklist on G1's first friendly business and write the real times in the timing
      table at the end. If the three steps take longer than about 10 minutes, the "about 10 minutes"
      claim in `offer.md`, `offer-sheet.md` and `scripts.md` changes.
- [x] **G1's walks** (owner D8, 2026-11-15): subdomain connects only. WordPress sites are skipped
      for all 50 (widened on #2698): don't pitch or set up a WordPress-run site. (WordPress publishing is
      also off on production: `WORDPRESS_CONNECT = false`, `src/lib/config/constants/publish.ts:231`;
      SPEC §5 *DNS only at launch*, `docs/SPEC.md:255`.)
- [ ] Ask the customer to have the login to where they bought their web address ready for the
      call (registrar or Cloudflare). Put it in the booking confirmation.

## Before the call (2 minutes)

- [ ] Their report open: `https://reachkit.app/scan/{domain}`.
- [ ] Find where their DNS lives, so you can tell them which login to have open. The setup screen
      names it too ("Your web address is at {provider}. Paste this there.", `setup.ts`
      `setup.destination.dnsAt`).
- [ ] Their row in the private `leads.csv`.

## On the call

### 1. Pay (2 min)

- [ ] They press Start on their report (the offer at its foot), or on `/pricing`.
- [ ] Stripe Checkout asks for email, card and country, and a VAT number only if they have one;
      no account first (SPEC §3). Let them fill it; don't guess.
- [ ] €49 a month, VAT included. After paying they land on `/setup`, signed in (SPEC §3 *Checkout
      lands signed in*).

### 2. Step 1, Site: "Is this your business?" (2 min)

The step bar reads **Site · Details · Connect**. This step alone says "The three steps take about
10 minutes." (`setup.step.time`, `setup.ts:396`).

- [ ] "Your website": their address, already filled from the report. "Change" if wrong.
- [ ] "Where your buyers are": country and language. **Pages are written in this language**
      (`setup.locale.note`). Germany, Austria and Switzerland → German.
- [ ] "City or area you serve": fill it for a local business; leave it empty if they sell
      nationwide or online (`setup.place.note`).
- [ ] Press **Save and continue**.

### 3. Step 2, Details: "What we found on your site" (1–2 min)

"Open a section to change it, or carry on." Narrate it in one line, so the call stays at 15
minutes (customer-success, #2693): "Nothing here must be changed; it's all in Settings later."

- [ ] Say the assurance aloud: "We never invent prices, people or reviews. If a fact isn't on your
      site, it won't be in your pages." (`setup.ts:456`).
- [ ] Glance at **Your market and competitors** together ("We found these competitors and update
      them every Monday. Remove or add any."). Remove a directory or marketplace if one slipped in.
- [ ] Skip **Five things only you know** on the call. It stays optional in Settings.
- [ ] If the screen says "We're still reading your site, so carry on", carry on.
- [ ] Press **Save and continue**.

### 4. Step 3, Connect: "Connect your website" (5–10 min)

The screen says "5–10 min, or send it to your web person" (`setup.ts:397`) and "Your first page is
ready or nearly ready. It goes live once your website is connected."

**The subdomain (the only path on production today)**

- [ ] "The first part of the address": the subdomain label. It starts as `content`
      (`HOSTED_SUBDOMAIN_LABEL`); `blog` or `articles` are fine if free. If refused: "That name is
      already taken. Try another." Pages will live at `{label}.{domain}`.
- [ ] They open "Paste this where you bought {domain}" and sign in there. Press **Show the steps**:
      the screen gives the steps for their provider (Cloudflare, GoDaddy, Namecheap, Squarespace,
      Route 53, Vercel, or general steps) with a Copy button per value.
- [ ] Add one **CNAME** record: Name = the label only (the provider adds the domain), Target or
      Value = the value on screen. Save.
- [ ] **Cloudflare:** set Proxy status to **DNS only** (the grey cloud). "With the proxy on, the
      connection often fails." (`setup.destination.dnsProxy`, `setup.ts:157`).
- [ ] Back on the screen, press **Check connection now**.
  - "Connected. Your first page goes live on its day, with nothing more to do." → done.
  - "Not found yet. It can take a few minutes to show. We keep checking every hour, so you can
    leave this page." → normal. Don't wait on the call; move to step 5.
  - "Your setting points to {target}. Change it to the value shown above." → fix the value.
- [ ] Their DNS is run by someone else: use "Or send these steps to your web person": enter that
      person's email and press **Send** (`setup.ts:579`).
- [ ] No login to hand: press **Do this later**. "We'll email you a reminder. Your first page waits
      for it." Don't book a follow-up: the product sends three setup reminders, 24, 72 and 168
      hours after paying, each with a signed-in link to connect, and stops once the site is live
      (`src/lib/mail/setup/reminders.ts:1–2`). If the
      second reminder (day 3) hasn't got them connected (no live page in `/app/review`), message
      them once.

**WordPress (skipped for all 50, D8; not on production; kept for after the first 50)**

Not among the first 50: a WordPress-run site is not set up on a first-50 call (owner D8,
2026-11-15, widened to all 50 on #2698).
When `WORDPRESS_CONNECT` is switched on (after #324 proves it on a real site), the Connect step
asks "Where should pages live?" and WordPress adds: "You'll connect it in Settings › Pages, with
your site address, username and an app password." (`setup.ts:601`). Then:

- [ ] In WordPress: Users → Profile → Application Passwords, make one named "ReachKit". "It isn't
      your login password, and you can revoke it there at any time."
      (`settings.destination.app-password.help`, `settings.ts:477`).
- [ ] In ReachKit: Settings › Pages → Site URL, Username, Application password → **Connect**.

Don't offer this path on a call until the flag is on.

### 5. Into the app (1 min)

- [ ] Setup releases them into the app. The first time, a short screen sets their time zone with
      nothing to press ("Setting your time zone").
- [ ] The app names the step it's on ("Checking your buyers and competitors", "Finding pages worth
      writing", "Writing your first page", "Checking it against your facts").
- [ ] Tell them what happens next, in these words:
      "Every Monday we plan up to 7 pages, new or updated. Each page goes live on its day, by
      itself. You can edit or stop any page first. You never have to. Cancel or export in Settings
      at any time." (`setup.connect.week.1–4`, `setup.ts:599–603`).
- [ ] Tell them the real set of emails: "You'll get an email for each page as it's ready until your
      first Monday email, one when your first page goes live, and after that one email every
      Monday. You can stop any page from those emails." Today they also get a sign-in email, one
      when setup is done and one when the website is connected (SPEC §8 *Page-ready until the first
      Monday mail*, *The first page's live mail only*, the onboarding row).

### 6. Close (1 min)

- [ ] "Where did you hear about ReachKit?" → `heard_from` in `leads.csv` (D7; the `?ref=` tag is
      stored only with a scan started from the landing, #2692).
- [ ] Book nothing else. Tell them the day-14 check-in is coming.
- [ ] Note the time each step took (table below).

## After the call (same day)

- [ ] Send a plain mail by hand, from your own mailbox, confirming the terms: "€49 a month, VAT
      included, cancel any time. You're one of the first 50 customers: I check in after two weeks
      and after a month, and you can email me directly. If anything in setup gets stuck, we do it
      together on a call." This is the written record (trust-compliance F7, #2693). Add no
      price-lock line until Terms §4 carries it (#2993). Note "terms mailed {date}" in `notes` in
      the private `leads.csv`.
- [ ] Within a week of setup: check `/app/review` › Pages for their first live page. The product's
      first-live email already carries the link, so a message from you is optional and must add
      something the email doesn't (e.g. "That's page one; the next lands {day}"). Not live within a
      week → call them and fix it together.
- [ ] Update the Progress table in the README (paying; set up in about 10 minutes, or on a call).
- [ ] Mark `paid`, `set_up_by` (`self` or `call`) and `first_live_on` in the private `leads.csv`.

## When it goes wrong

| On screen | What it means | Do |
|---|---|---|
| "We can't reach that website. Check the spelling, or write to hello@reachkit.app for help." | The address doesn't load | Check `www` and spelling; otherwise write to support |
| "That isn't a web address. Enter one like yourdomain.com." | Typo | Retype |
| "We couldn't find enough searches for your market to plan pages yet. Pick a broader market and we'll scan again right away." | Market too small | Pick a broader market from "Broader markets to try", press **Check this market now** |
| "Your site doesn't say enough about what you sell to write a new page. Add what you sell and who you serve in Settings › Your business." | Thin site | Add 2–3 lines in Settings › Your business together |
| "Not connected yet. New settings can take a few hours, and we check every hour." | DNS not seen yet | Normal; check again later that day |
| "This step wasn't saved. Check your connection and press again." | Network blip | Press again |

## Timing (fill from G1)

| Business | Kind | Pay | Site | Details | Connect | Total | Connected on the call? | First page live after |
|---|---|---|---|---|---|---|---|---|
| G1 #1 (subdomain) | | | | | | | | |
| G1 #2 (subdomain) | | | | | | | | |
