# R8: Setup-call checklist

**Audience:** the owner, on a 15-minute call with a founding customer. **Message to them:** "We'll
have your site connected before we hang up." **Outcome:** paid, set up and connected on the call;
first page live within 48 hours of connecting (the D2 service promise).

Checked against the real flow on 2026-11-15: `src/app/(account)/setup/**` and
`src/lib/presentation/copy/keys/setup.ts`. Quoted words are what the customer sees on screen.

## Owner to do

- [ ] Run this checklist on G1's first friendly business and write the real times in the timing
      table at the end. If connecting takes longer than 15 minutes, the "15-minute call" claim in
      `offer.md`, `offer-sheet.md` and `scripts.md` changes.
- [x] **G1's walks** (owner D8, 2026-11-15): subdomain connects only. WordPress sites are skipped
      for wave 1: don't pitch or set up a WordPress-run site in wave 1. (WordPress publishing is
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
- [ ] Stripe Checkout asks only for card details and email; no account first (SPEC §3).
- [ ] €49 a month, VAT included. After paying they land on `/setup`, signed in (SPEC §3 *Checkout
      lands signed in*).
- [ ] If Checkout asks for a VAT number or business details, let them fill it; don't guess.

### 2. Step 1, Site: "Is this your business?" (2 min)

The step bar reads **Site · Details · Connect**. This step alone says "The three steps take about
10 minutes." (`setup.step.time`, `setup.ts:396`).

- [ ] "Your website": their address, already filled from the report. "Change" if wrong.
- [ ] "Where your buyers are": country and language. **Pages are written in this language**
      (`setup.locale.note`). Germany, Austria and Switzerland → German.
- [ ] "City or area you serve": fill it for a local business; leave it empty if they sell
      nationwide or online (`setup.place.note`).
- [ ] Press **Save and continue**.

### 3. Step 2, Details: "What we found on your site" (3 min)

"Open a section to change it, or carry on." Nothing here must be changed.

- [ ] **Your business**: what you do, what you sell, who you serve, what you promise, words you
      use, facts we can quote. Say the assurance aloud: "We never invent prices, people or reviews.
      If a fact isn't on your site, it won't be in your pages." (`setup.ts:456`).
- [ ] **Your market and competitors**: "We found these competitors and update them every Monday.
      Remove or add any." Up to five. Remove a directory or marketplace if one slipped in.
- [ ] **How your pages sound**: read their voice line; they may edit it or leave it.
- [ ] **Five things only you know** (optional): if they have one minute, ask "What do you do that
      your competitors don't?" and "A result a customer got, in numbers if you have them". These
      become facts the pages can use. Otherwise skip; it's also in Settings.
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
      for it." Book a 5-minute follow-up for the same week.

**WordPress (skipped for wave 1, D8; not on production; keep for when it is)**

Not in wave 1: a WordPress-run site is not set up on a wave-1 call (owner D8, 2026-11-15). After
wave 1, unless the owner rules otherwise, a WordPress site gets the subdomain above, which works
beside WordPress and needs no plugin.
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
- [ ] "You'll get an email when a page is ready to read, and one when your first page goes live.
      After that, one email every Monday." (SPEC §8 *Page-ready until the first Monday mail*, *The
      first page's live mail only*).

### 6. Close (1 min)

- [ ] "Where did you hear about ReachKit?" → `heard_from` in `leads.csv` (D7; the `?ref=` tag is not
      stored yet).
- [ ] Book nothing else. Tell them the day-14 check-in is coming.
- [ ] Note the time each step took (table below).

## After the call (same day)

- [ ] Within 48 hours of "Connected": check their first page is live on `{label}.{domain}` and
      message them the link (playbook step 6). Not live by 48 hours → call them and fix it together
      (D2 service promise).
- [ ] Update the Progress table in the README (paying, live within 48 h).
- [ ] Mark `paid` and `live_within_48h` in the private `leads.csv`.

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
