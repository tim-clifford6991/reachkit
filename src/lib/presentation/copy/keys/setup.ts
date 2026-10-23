// BUILD §2.5 — setup's sentences.
// src/lib/presentation/copy/keys/setup.ts — BP-020 decision 5, WO-041
//
// Setup's sentences. Seeded empty by WO-041; filled by issue #14, the block
// that owns §4.3.
//
// **The first six values filled were each a transcription of a word
// `BUILD.md` §4.3 itself prints** — on the same footing as the thirteen
// band words and the five `shell.*` keys issue #9 filled: "**Your market**
// — inferred category chip, Change", "**Competitors**", "*Hosted blog*",
// "*WordPress*", and the footer's own verb, "Start". Nothing here is
// composed.
//
// **No sentence on this screen states how long anything takes.** REQ-025
// c1: "nothing on the screen states how long the deep pass, or the
// founder's first page, will take". §4.3's old footer control ("Start —
// first page in ~3 minutes.") and the one-screen head ("Three decisions,
// then we start.") are both gone with the five-step redesign of 2026-09-20
// (#908, #922): there is no one submit to hang an estimate on, and each
// step is headed by its own question. The absence is asserted rather than
// reviewed — `tests/app/setup/screen.test.tsx` and `waiting.test.tsx` scan
// every rendered step for a duration, an estimate, a countdown, a clock or
// a percentage, and each carries a mutation check proving the scan still
// catches one.
//
// The two publishing *mode* names are not here: §4.3's "Autopilot" and
// "Copilot" are already `shell.publishing.mode.*` in `laws.ts`, which the
// app shell renders on every screen. One word, one key, both surfaces.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const SETUP_COPY = Object.freeze({
  // ── The screen ──────────────────────────────────────────────────────
  /** REQ-025 c5's exception in one line: a founder whose account cannot be
   *  read is told so, and told they can still reach Settings, cancel and
   *  export with setup unfinished. */
  /** Issue 1196: a step whose request never came back. Drafted; the owner
   *  may correct it. */
  "setup.refused.could-not-ask": ["We couldn’t reach ReachKit just now, so this step wasn’t saved. Check your connection and press again.", { slots: {}, fixedBy: "issue 1196" }],
  "setup.refused.no-access": ["We couldn’t find an active plan for this account, so setup can’t start. Settings stays open to cancel or export.", { slots: {}, fixedBy: "REQ-025 c5" }],
  // ── The progress strip (UI-SPEC S10 · S11, issue #356) ──────────────
  "setup.progress.paid": ["Paid", { slots: {}, fixedBy: "S10 · 11a" }],
  "setup.progress.setup": ["Setup", { slots: {}, fixedBy: "S10 · 11a" }],
  "setup.progress.first-page": ["First page", { slots: {}, fixedBy: "S10 · 11a" }],

  // ── The two arms' own lines (UI-SPEC S10, issue #356) ───────────────
  "setup.address.assurance": [
    "The site we check and put your pages live on. Nothing is taken from the address you paid with.",
    { slots: {}, fixedBy: "S10 · REQ-021 c7" },
  ],
  "setup.competitors.add.placeholder.first": [
    "competitor.com",
    { slots: {}, fixedBy: "S10 · REQ-026 c3" },
  ],
  "setup.footer.line": [
    "You can reach Settings, cancel or export at any time, without finishing setup.",
    { slots: {}, fixedBy: "S10 · REQ-021 c10" },
  ],

  // ── The site address (REQ-021) ──────────────────────────────────────
  "setup.address.title": ["Your site", { slots: {}, fixedBy: "REQ-021 c6 · S10 (11a)" }],
  "setup.address.label": ["Your website", { slots: {}, fixedBy: "REQ-021 c7 · S10 (11a)" }],
  "setup.address.placeholder": ["yourdomain.com", { slots: {}, fixedBy: "REQ-021 c7 · S10 (11a)" }],
  /** The line beside an address a completed report measured — shown to
   *  confirm or change, never retyped (REQ-021 c6). */
  "setup.address.measured": ["The site your free report checked. Keep it, or change it.", { slots: {}, fixedBy: "REQ-021 c6" }],
  "setup.address.change": ["Change", { slots: {}, fixedBy: "REQ-021 c6 · S10 (11a)" }],
  "setup.address.refused.not-a-domain": ["That isn’t a domain. Enter one like yourdomain.com.", { slots: {}, fixedBy: "REQ-021 c9" }],
  /** REQ-021 c9 and c10 in one line: it says the address cannot be
   *  reached, names one way to reach a person, and tells the founder they
   *  can cancel without finishing setup. */
  "setup.address.refused.unreachable": ["We can’t reach that website. Check the spelling, or write to hello@reachkit.app and a person will help. You can cancel from Settings without finishing setup.", { slots: {}, fixedBy: "REQ-021 c10" }],
  "setup.address.missing": ["Your site address is needed before setup can start.", { slots: {}, fixedBy: "REQ-021 c7" }],

  // ── Your market (REQ-026) ───────────────────────────────────────────
  "setup.market.change": ["Change", { slots: {}, fixedBy: "REQ-026 c1" }],
  /** REQ-026 c3: the empty card asks them to state their market in their
   *  own words, with nothing pre-filled and nothing presented as inferred. */
  "setup.market.state-it": ["State your market in a few words.", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.label": ["Your market, in your words", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.placeholder": ["payroll software for small teams", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.missing": ["Your market is needed to start.", { slots: {}, fixedBy: "REQ-026 c5" }],

  // ── Competitors (REQ-026) ───────────────────────────────────────────
  "setup.competitors.title": ["Competitors", { slots: {}, fixedBy: "REQ-026 c7" }],
  // D28 (owner, 2026-10-02, #1185): drafted, named in the pull request.
  "setup.competitors.concluded": [
    "ReachKit found these competitors in your market and keeps them current each week. Remove or add any if you like.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  "setup.market.concluded": [
    "ReachKit read this from your site and keeps it current each week. Change it only if it’s wrong.",
    { slots: {}, fixedBy: "SPEC §5 2026-10-02 D28, issue 1185" },
  ],
  /** REQ-026 c10, first limb: waiting on the market, never "none found". */
  "setup.competitors.awaiting-market": ["Suggested once your market is stated.", { slots: {}, fixedBy: "REQ-026 c10" }],
  "setup.competitors.seeking": ["Looking for competitors in your market…", { slots: {}, fixedBy: "REQ-026 c10" }],
  /** REQ-026 c10, second limb: a known market whose suggestions came back
   *  empty. */
  "setup.competitors.none-found": [
    "No competitors could be suggested for this market yet. Add up to five, or continue; ReachKit finds them as it reads your market.",
    { slots: {}, fixedBy: "REQ-026 c10 · S10 (11a)" },
  ],
  /** REQ-026 c9: the limit is stated on screen rather than silently
   *  enforced. `{max}` is `BATTERY.COMPETITORS_MAX`. */
  /** The set draws "3 of 5": the count chosen and the limit, both slots. */
  "setup.competitors.limit": [
    "{chosen} of {max}",
    { slots: { chosen: "text", max: "text" }, fixedBy: "S10 · REQ-026 c9" },
  ],
  "setup.competitors.add.label": ["Add a competitor", { slots: {}, fixedBy: "REQ-026 c8 · S10 (11a)" }],
  "setup.competitors.add.placeholder": ["add another", { slots: {}, fixedBy: "REQ-026 c8 · S10 (11a)" }],
  "setup.competitors.add.action": ["Add", { slots: {}, fixedBy: "REQ-026 c8 · S10 (11a)" }],
  /** The accessible name on a chosen tag's ×, naming the rival it takes
   *  out. The set draws the glyph and no words. */
  "setup.competitors.remove": ["Remove {rival}", { slots: { rival: "text" }, fixedBy: "REQ-026 c7" }],
  "setup.competitors.refused.not-a-domain": ["That isn’t a domain. Enter one like competitor.com.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.does-not-resolve": ["That domain doesn’t resolve. Check the spelling.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.own-domain": ["That’s your own site, not a competitor.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.already-present": ["That domain is already in your list.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.set-full": ["Your list is full. Remove a competitor to add another.", { slots: {}, fixedBy: "REQ-026 c9" }],

  // ── Destination (REQ-028) ───────────────────────────────────────────
  // No mode pair and no mode title (SPEC §7, #476): the card is headed with
  // `settings.publishing.title`.
  "setup.destination.where": ["Where should pages live?", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.destination.hosted.name": ["On a new address we run", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.destination.hosted": ["One setting, once. Recommended.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.destination.wordpress.name": ["On my WordPress site", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.destination.wordpress": [
    "Pages go live on it. You make us a separate WordPress password.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],
  /** Issue 759 (owner ruling 2026-09-16): where that provider is — beside
   *  the record on `/setup` and in Settings. Since issue 760 it is the
   *  fallback for a lookup that could not answer. */
  "setup.destination.dnsWhere": [
    "Copy this where your web address is managed: usually the company you bought it from, or Cloudflare if your address is on it.",
    { slots: {}, fixedBy: "SPEC §5 · §12 (2026-09-16, issue 759)" },
  ],
  /** Issue 760 (owner ruling 2026-09-16): the guidance is derived, not
   *  generic. An NS lookup on the site's domain names where the record is
   *  added — the provider where the nameservers are one we know, the
   *  nameserver itself where they are not (never a guessed brand), and
   *  `dnsWhere` above where nothing could be looked up. `dnsProxy` is shown
   *  only when the provider is Cloudflare. `{provider}` is a brand and
   *  `{nameserver}` a host name: data, never composed words. */
  "setup.destination.dnsAt": [
    "Your web address is managed at {provider}. Copy this there.",
    { slots: { provider: "text" }, fixedBy: "SPEC §5 (2026-09-16, issue 760)" },
  ],
  "setup.destination.dnsNameserver": [
    "Your web address is served by {nameserver}. Copy this wherever that is managed.",
    { slots: { nameserver: "text" }, fixedBy: "SPEC §5 (2026-09-16, issue 760)" },
  ],
  /** Issue 856 (owner 2026-09-17): one instruction, not a choice. A proxied
   *  record did verify for `content.reachkit.app` on 2026-09-16, but a
   *  hosted custom domain behind Cloudflare's proxy commonly fails its
   *  certificate, and "either works, try the other if not" left the
   *  founder to choose. DNS only is the instruction; the reason is one
   *  line. Shown only on Cloudflare. */
  "setup.destination.dnsProxy": [
    "Set Proxy status to DNS only (the grey cloud). With Cloudflare’s proxy on, the secure certificate often can’t be issued and the connection won’t verify.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" },
  ],

  // ── The DNS guide (issue 856; owner 2026-09-17) ─────────────────────
  //
  // Per-provider steps beside the record, chosen from the nameserver lookup
  // (issue 760). `{zone}` is the domain the record is added under, `{name}`
  // exactly what goes in the provider's name field — the host less its
  // zone — and `{host}` the full name. Field labels and values are the
  // provider's own words as its dashboard prints them. Drafted; the owner
  // corrects the wording.
  "setup.destination.guide.column.field": ["Field", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.column.value": ["Enter", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.copy": ["Copy", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.copied": ["Copied", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.open": ["Open your {provider} DNS settings", { slots: { provider: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.full-name": ["The full name of this record is {host}.", { slots: { host: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.field.type": ["Type", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.name": ["Name", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.target": ["Target", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.value": ["Value", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.host": ["Host", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.data": ["Data", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.proxy-status": ["Proxy status", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.ttl": ["TTL", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.record-name": ["Record name", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.record-type": ["Record type", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.routing-policy": ["Routing policy", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.generic-name": ["Name (or Host)", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.field.generic-target": ["Target (or Value, Points to)", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.value.dns-only": ["DNS only", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.value.auto": ["Auto", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.value.automatic": ["Automatic", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.value.simple-routing": ["Simple routing", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.cloudflare.1": ["Open the Cloudflare dashboard and choose {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.cloudflare.2": ["Go to DNS, then Records, and press Add record.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.cloudflare.3": ["Fill in the fields as shown. In Name, enter only {name} — Cloudflare adds {zone} itself.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.cloudflare.4": ["Set Proxy status to DNS only, then press Save.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.godaddy.1": ["Sign in to GoDaddy, open {zone} from your domains and choose DNS.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.godaddy.2": ["Press Add New Record and choose CNAME as the type.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.godaddy.3": ["Fill in the fields as shown. In Name, enter only {name} — GoDaddy adds {zone} itself.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.godaddy.4": ["Press Save.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.namecheap.1": ["Sign in to Namecheap, open Domain List and press Manage beside {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.namecheap.2": ["Open the Advanced DNS tab, press Add New Record and choose CNAME Record.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.namecheap.3": ["Fill in the fields as shown. In Host, enter only {name} — Namecheap adds {zone} itself.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.namecheap.4": ["Press the green tick to save the record.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.squarespace.1": ["Sign in to Squarespace, open Domains and choose {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.squarespace.2": ["Open DNS, then DNS Settings, and under Custom records press Add record.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.squarespace.3": ["Fill in the fields as shown. In Host, enter only {name} — Squarespace adds {zone} itself.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.squarespace.4": ["Press Save.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.route53.1": ["Open Route 53 in the AWS console, choose Hosted zones and open {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.route53.2": ["Press Create record.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.route53.3": ["Fill in the fields as shown. In Record name, enter only {name} — Route 53 shows {zone} after the box.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.route53.4": ["Press Create records.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.vercel.1": ["Open the Vercel dashboard, go to Domains and choose {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.vercel.2": ["Under DNS Records, fill in the fields as shown. In Name, enter only {name} — Vercel adds {zone} itself.", { slots: { name: "text", zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.vercel.3": ["Press Add.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],

  "setup.destination.guide.generic.1": ["Sign in where your domain’s DNS is managed and open the DNS records for {zone}.", { slots: { zone: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.generic.2": ["Add a new record of type CNAME and fill in the fields as shown. In the name field, enter only {name}; if your provider asks for the full name, enter {host}.", { slots: { name: "text", host: "text" }, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  "setup.destination.guide.generic.3": ["Save the record. If your provider offers a proxy or forwarding for it, leave that off.", { slots: {}, fixedBy: "SPEC §5 (2026-09-17, issue 856)" }],
  /** REQ-028 c2: the written line that stands where the record will sit
   *  until a site address is given — never a blank, dash or placeholder. */
  "setup.destination.dnsPending": ["The setting shows once your site is given.", { slots: {}, fixedBy: "REQ-028 c2" }],

  // ── The subdomain label (SPEC §5, ruling of 2026-09-12) ─────────────
  //
  // §5 made the label the customer's: "a subdomain label the customer
  // chooses (default `content`), refusing an invalid or already-taken
  // label in one written line". The approved artboard draws the field with
  // a bracketed placeholder — `OnboardingPublishing.dc.html`: "[COPY:
  // choose the subdomain, e.g. blog or content]" — which is the canvas's
  // own way of saying the sentence is not written yet.
  //
  // **Three keys, all owed.** `CLAUDE.md`'s standing rule: add the key,
  // leave the value `TODO(copy)`, name it in the PR. The marker renders as
  // itself, so the field and each refusal are visibly unwritten rather
  // than invisibly absent — and no sentence here was composed to fill
  // them. The two words the state is read as ("waiting for DNS", "live")
  // are §5's own and are written, in `settings.ts`.
  "setup.destination.label.label": [
    "Subdomain",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-12) · Canvas: Setup" },
  ],
  /** The one written line for a label that is not a label at all. */
  "setup.destination.label.refused.invalid": [
    "That isn’t a valid subdomain.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-12)" },
  ],
  /** The one written line for a label somebody else already serves at. */
  "setup.destination.label.refused.taken": [
    "That subdomain is already taken.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-12)" },
  ],
  /** Issue #757: a "check connection" press on `/setup` for an address the
   *  founder has changed on screen but not submitted. The server knows only
   *  the site's stored address as theirs, and asks about no other host. */
  "setup.destination.check.address-unsaved": ["Confirm your site address first. This setting is for the address ReachKit has.", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],

  // ── The waiting screen (REQ-029) ────────────────────────────────────
  "setup.waiting.head": ["Your first page is coming", { slots: {}, fixedBy: "REQ-029 c1" }],
  /** One line per stage of the pass. Which step is under way, in written
   *  words — never a bare spinner, and never how long. */
  //
  // **Five keys, not the engine's six** (issue #356). These were one key
  // per `StageName` — the scan's own dataset boundaries — and all six were
  // owed, so the screen drew six unwritten rows. UI-SPEC S11 draws five
  // named rows and names them, unbracketed, so ruling 11a makes these the
  // words. `_setup/stages.ts` holds which engine handles each row covers,
  // and a test asserts the mapping spans `STAGES` exactly.
  //
  // The last two rows name work after the scan — §8's writing and §9's
  // checking — which the engine's handles do not reach, so they are drawn
  // and never current. That is the set's own drawing, not an omission.
  "setup.waiting.stage.measuring-your-market": [
    "Checking your buyers and competitors",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],
  "setup.waiting.stage.sizing-your-rivals": [
    "Sizing your competitors",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],
  "setup.waiting.stage.finding-pages": [
    "Finding pages worth writing",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],
  "setup.waiting.stage.writing-your-first-page": [
    "Writing your first page",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],
  "setup.waiting.stage.checking-it": [
    "Checking it",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],

  // ── No stated time zone yet (issue 753) ─────────────────────────────
  //
  // Where a founder who finished setup lands while their site has no zone:
  // the app draws every date in the site's own zone and never in the
  // server's (REQ-073 c1), so it cannot open yet. The browser reports its
  // zone from this screen and the founder is taken on to the app. Drafted
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "setup.zone.head": ["Setting your time zone", { slots: {}, fixedBy: "board SetupZone · issue 1738" }],
  "setup.zone.line": ["ReachKit shows every date in your own time zone, so it needs yours before the app opens. Your browser is telling us now.", { slots: {}, fixedBy: "issue 753" }],
  "setup.zone.why": ["Why it matters", { slots: {}, fixedBy: "board SetupZone · issue 1738" }],
  /** `{time}` is the site's own publish time. */
  "setup.zone.example": ["Goes live {time}, your time", { slots: { time: "text" }, fixedBy: "board SetupZone · issue 1738" }],
  "setup.zone.example.not": ["Not someone else’s {time}.", { slots: { time: "text" }, fixedBy: "board SetupZone · issue 1738" }],
  "setup.zone.once": ["This takes a few seconds and happens once. Nothing to press.", { slots: {}, fixedBy: "board SetupZone · issue 1738" }],
  /** Shown once the browser has said nothing for ten seconds; the support address follows it as a link. */
  "setup.zone.slow": ["Your browser hasn’t told us its time zone yet. Reload this page. If you still see this, write to", { slots: {}, fixedBy: "board SetupZone · issue 1738" }],

  // ── Your voice (SPEC.md §5, 2026-09-12; renamed 2026-09-17, issue 839) ─
  //
  // §5's "The site profile is confirmed here": the page inventory, the site
  // name and the editable brand voice, drawn on the Check board
  // (`docs/design/boards/canvas/Setup2.dc.html`).
  //
  // The eight purpose words are keys and not raw tokens for the same
  // reason the band words are: `pricing` is an identifier the engine
  // classifies by, and what a customer reads beside a count is a word the
  // owner chooses.
  /** The line above the purpose chips — what each page is for. */
  "setup.profile.purposes": ["What these pages are for", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  "setup.profile.voice.label": ["How your pages sound", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** Above an empty voice box, where no voice has been read of the site
   *  yet — the free scan does not read one, and the deep pass that does
   *  runs after this submit. Drafted under the owner ruling of 2026-09-16
   *  (issue 759); the owner corrects the wording. */
  "setup.profile.voice.unread": [
    "ReachKit hasn’t read your voice yet. Describe how your site sounds, or leave this empty and ReachKit reads it from your pages.",
    { slots: {}, fixedBy: "issue 839" },
  ],
  /** The note under the voice box: the same text is editable in Settings
   *  afterwards (§5's done-when, 2026-09-12). */
  "setup.profile.voice.later": [
    "You can change this later in Settings.",
    { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" },
  ],
  "setup.profile.purpose.pricing": ["Pricing", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.about": ["About", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.features": ["Features", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.product": ["Product", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.blog": ["Blog", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.contact": ["Contact", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.legal": ["Legal", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.other": ["Other", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],

  // ── The release notice (issue #36) ──────────────────────────────────
  //
  // The one written sentence that travels with a founder into the app
  // when their pass did not finish clean. Projected from the current
  // report every time it is asked for — `src/lib/scan/deep/notice.ts` —
  // so it stops being shown the moment a later pass makes it untrue,
  // with no flag stored and none to clear.
  //
  // Neither declares a slot. The unmeasured parts are carried beside the
  // key as internal handles rather than substituted into the sentence:
  // turning a list of handles into a phrase is composition, and composing
  // is the owner's, not the engine's. When the sentence should name them,
  // the slot and its per-part keys are added here.

  /** REQ-029 c3: the pass measured some of it. One sentence saying what
   *  could not be measured. */
  "setup.release.unmeasured": ["Your first scan fell short in places. What it found is shown with its date; the next scan fills in the rest.", { slots: {}, fixedBy: "REQ-029 c3" }],
  /** REQ-029 c5: the pass failed outright, or had not ended when the
   *  founder was released anyway. One sentence saying the measurement did
   *  not complete — never that it found nothing, which is a different
   *  fact with its own line (§7). */
  "setup.release.incomplete": ["Your first scan didn’t complete. Nothing is needed from you; the next scan fills it in.", { slots: {}, fixedBy: "REQ-029 c5" }],
  /** Issue #770: the pass read the market and found too few searches to
   *  plan a page from — a measurement, not a failure. Issue 837 (owner,
   *  2026-09-17): it points at the choice beside it, never at a week. */
  "setup.release.market-too-small": ["We couldn’t find enough searches for your market to plan pages yet. Pick a broader market and we’ll scan again right away.", { slots: {}, fixedBy: "issue 770" }],
  /** Issue 855 (owner, 2026-09-17): the pass stopped on a ceiling before it
   *  finished reading the market. Not a market too small, and nothing for
   *  the founder to change. Drafted under issue 759's ruling. */
  "setup.release.measuring": ["Your market is still being scanned. ReachKit scans it again automatically, and your first pages follow.", { slots: {}, fixedBy: "issue 855" }],

  // Issue 837 (owner ruling 2026-09-17): the choice a thin market offers —
  // two or three broader categories from the site's own profile, and the
  // founder's own words — and the two ways a press is refused. Drafted under
  // issue 759's ruling; the owner corrects the wording.
  "setup.remeasure.suggested": ["Broader markets to try", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.own": ["Or describe your market in your own words", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.submit": ["Scan again now", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.empty": ["Type a market, or pick one of the suggestions.", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.running": ["Your market is already being scanned. Your pages follow as soon as it finishes.", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.daily-limit": ["You’ve scanned your market as many times as a day allows. You can scan again after {time}.", { slots: { time: "text" }, fixedBy: "issue 837" }],

  // ── The five steps (SPEC §5, 2026-09-20, #908) ──────────────────────
  //
  // "setup is **five saved steps** — your site, your business, rivals,
  // your voice, publishing — one decision each, with Back, and an
  // equal-column step indicator."
  //
  // Every sentence in this block is **drafted** under the ruling of
  // 2026-09-16 (#759): the owner-approved redesign states what each screen
  // holds and in what words, and issue #922 lists the questions; the rest
  // is written in this registry's voice and the owner corrects it. Two of
  // the canvas's own lines are deliberately not transcribed: a line that
  // says "on the right" is false on a phone, where the panel sits under
  // the question, and a line that promises a sample paragraph is promising
  // #923's panel. Both are written here for the screen this issue ships.

  /** The one-word labels on the daisyUI `steps` indicator, three equal columns. */
  "setup.step.site": ["Site", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.step.check": ["Check", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.step.publishing": ["Connect", { slots: {}, fixedBy: "owner E11 · issue 1601" }],

  /** Where the founder is, and the time the founder's own part takes — never ReachKit's work (SPEC §5, 2026-09-21). */
  "setup.step.count": ["Step {n} of {total}", { slots: { n: "text", total: "text" }, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.step.time": ["about 10 minutes, once", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],

  /** One question per step — the screen's `<h1>`. */
  "setup.step.site.question": ["Is this your business?", { slots: {}, fixedBy: "issue 922" }],
  "setup.step.check.question": ["Here’s what we read", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.step.publishing.question": ["Connect your website", { slots: {}, fixedBy: "owner E11 · issue 1601" }],

  /** The line under each question. */
  "setup.step.site.line": [
    "Your free scan read this site. We write every page for it, so fix anything wrong now.",
    { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" },
  ],
  "setup.step.check.line": [
    "Every page we write uses this. Open a section to change it, or carry on.",
    { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" },
  ],
  /** No hour: each site sets its own publish time. */
  "setup.step.publishing.line": [
    "Your first page goes live on its day, once your website is connected. We’re already writing it.",
    { slots: {}, fixedBy: "owner E11 · issue 1601" },
  ],

  /** The controls at the foot of every step. "Looks right" leaves Check. */
  "setup.back": ["Back", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.continue": ["Continue", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.check.confirm": ["Looks right", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.finish": ["Finish", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],

  // ── Check: here's what we read ─────────────────────────────────────
  /** `{time}` is when the running pass began, on the founder's clock. Shown only while a pass runs. */
  "setup.check.status": ["Checking your buyers and competitors · started {time}", { slots: { time: "text" }, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  /** `{n}` is the inventory's own row count — what was read, never a target. */
  "setup.check.pages": ["{n} pages read", { slots: { n: "text" }, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.figure.site": ["Your site", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.figure.read": ["What we read", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.figure.pages": ["Every page", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  /** The pill on a section ReachKit filled in, and on the one that asks. */
  "setup.check.read": ["read", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.optional": ["optional", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.business": ["Your business", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.market": ["Your market and competitors", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.market.summary": ["{market} · {n} competitors", { slots: { market: "text", n: "text" }, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.voice": ["Your voice", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  "setup.check.asks.summary": ["Answer any, or none.", { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" }],
  /** Before the profile crawl has read a page. */
  "setup.check.unread": [
    "We’re still reading your site. Carry on. What we find shows in Settings, where you can change it.",
    { slots: {}, fixedBy: "SPEC §5 · board Setup2 · issue 1737" },
  ],

  // ── What happens next: the rail beside Site and Check ──────────────
  "setup.next.title": ["What happens next", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.here": ["you are here", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.site": ["Confirm your site", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.site.line": ["Where your buyers are.", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.check": ["Check what we read", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.check.line": ["Fix anything wrong, or carry on.", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.publishing": ["Connect your website", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.publishing.line": ["One setting, copied from us.", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.after": ["After this, nothing to do", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.next.after.line": ["Pages go live on their day. A Monday email shows what moved.", { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],

  // ── Step two: what we learned about your business ───────────────────
  //
  // SPEC §5 (2026-09-20): "what the site does, sells and promises, who it
  // serves, the words it uses, and the facts that may be quoted with the
  // page each was read from. Every item can be removed and the founder can
  // add their own."
  //
  // The groups below are the confirmed business profile's
  // (`src/lib/site-profile/business/types.ts`), in the board's order:
  // what you do, sell, serve, promise, the words you use, the facts.

  /** The owner's own sentence (issue #922), under the pages-read chips. */
  "setup.business.assurance": [
    "We never invent prices, people or reviews. If a fact isn’t on your site, it won’t be in your pages.",
    { slots: {}, fixedBy: "issue 922" },
  ],
  "setup.business.group.job": ["What you do", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.business.group.products": ["What you sell", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.business.group.audienceTerms": [
    "Who you serve",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.claims": ["What you promise", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.business.group.vocabulary": ["Words you use", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  "setup.business.group.facts": ["Facts we can quote", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  /** The quiet note beside each group head. `{max}` is the list's own
   *  bound, from `VOICE_LIST_MAX`. */
  "setup.business.group.products.note": [
    "up to {max}",
    { slots: { max: "text" }, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.job.note": [
    "one sentence",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.audienceTerms.note": [
    "2 to {max}",
    { slots: { max: "text" }, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.claims.note": [
    "we may repeat these",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.vocabulary.note": [
    "so pages sound like you",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.group.facts.note": [
    "in your own words, from your own pages",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  /** The accessible name on an item's ×. `{item}` is the founder's own
   *  text, data and never composed words. */
  "setup.business.remove": [
    "Remove {item}",
    { slots: { item: "text" }, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.add": ["Add", { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" }],
  /** The label on a group's own add field. `{group}` is the group head
   *  above it, so the field is named even when the head is scrolled off. */
  "setup.business.add.label": [
    "Add to {group}",
    { slots: { group: "text" }, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.empty": [
    "Nothing read for this yet. Add what we missed.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  "setup.business.full": [
    "This list is full. Remove one to add another.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  // SPEC §5 (2026-09-29, issue 1133): the five optional questions, each one
  // field, on this step and in Settings › Your business. The questions are
  // the ruling's own; the head and its note are drafted for the owner.
  "setup.business.questions": [
    "Five things only you know",
    { slots: {}, fixedBy: "issue 1133 (drafted)" },
  ],
  "setup.business.questions.note": [
    "Optional. We use an answer in your pages as something you told us.",
    { slots: {}, fixedBy: "issue 1133 (drafted)" },
  ],
  "setup.business.question.buyers": [
    "Who buys from you, and why?",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-29, issue 1133, drafted)" },
  ],
  "setup.business.question.edge": [
    "What do you do that your competitors don’t?",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-29, issue 1133, drafted)" },
  ],
  "setup.business.question.asked": [
    "What do buyers ask before they buy?",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-29, issue 1133, drafted)" },
  ],
  "setup.business.question.result": [
    "A result a customer got, in numbers if you have them",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-29, issue 1133, drafted)" },
  ],
  "setup.business.question.byline": [
    "Your name and one line about you, shown on your pages as the writer",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-29, issue 1133, drafted)" },
  ],

  // ── Step four: your voice ───────────────────────────────────────────
  /** The second list on the voice step — the claims the site never makes
   *  and ReachKit must not start making (`VoiceSummary.claimsToAvoid`). */
  "setup.voice.never": [
    "Things we should never say about you",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],

  // ── The panel beside the question ───────────────────────────────────
  "setup.panel.publishing.title": [
    "Your website, ready to publish",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  /** Under the panel, for the whole of setup: nothing on this screen waits
   *  on the pass (SPEC §5, 2026-09-20). */
  "setup.panel.note": [
    "Each answer starts the next piece of our work. Nothing here needs you to wait.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  /** What the placeholders stand for, said once rather than drawn as a
   *  blank: the founder's first page is not written yet. */
  "setup.panel.awaiting": [
    "Your first pages appear here once ReachKit has written them.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  /** The address the hosted blog will serve at, before it serves anything,
   *  where no site address has been given yet. */
  "setup.panel.address.pending": [
    "Your blog’s address appears once you’ve given your site.",
    { slots: {}, fixedBy: "SPEC §5 (2026-09-20, issue 908)" },
  ],
  // ── SPEC §5 (2026-09-20, #908, #923): the right-hand side that matches
  // each step, and names the work already done.
  //
  // Every sentence below is **drafted** under the owner's 2026-09-16 ruling
  // (#759) and the PR names each one so the owner can correct it.


  // The blog mock-up's own lead line: the market the scan read, where it
  // read one. A market it did not read is a `skeleton`, never this line
  // with a guess in it.
  "setup.panel.blog.market": [
    "For businesses searching for {market}.",
    { slots: { market: "text" }, fixedBy: "SPEC §5 2026-09-20" },
  ],
  // The line that stands where the record used to, on the publishing step
  // (#924). It says the address is theirs and that connecting it is the
  // next thing, rather than asking them to do it here.
  "setup.destination.connect-next": [
    "We’ll reserve this address. Connecting it is one setting, and it’s the next screen.",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],

  // ── SPEC §5 (2026-09-20, #908, #924): the DNS record as its own step
  // after setup. This supersedes the 2026-09-16 ruling (#757) that it be
  // completed on the setup page.
  //
  // Every sentence below is **drafted** under the owner's 2026-09-16 ruling
  // (#759) and the PR names each one so the owner can correct it.
  "setup.connect.eyebrow": [
    "One last thing · about 5 minutes",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],
  "setup.connect.title": ["Connect your website", { slots: {}, fixedBy: "owner E11 · issue 1601" }],
  "setup.connect.lead": [
    "Add one setting where your web address is managed. We show you exactly what to copy. Your first page is being written while you do this.",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],
  // The two ways onward. Neither is a lesser path, and the note beside the
  // timeline says so.
  "setup.connect.later": ["Do this later", { slots: {}, fixedBy: "SPEC §5 2026-09-20" }],
  "setup.connect.onward.live": ["It’s connected. Go to your dashboard", { slots: {}, fixedBy: "SPEC §5 2026-09-20" }],
  "setup.connect.skipping": [
    "If you do it later, we’ll remind you, and your first page waits for it. The setting is also on your Overview.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],

  // What happens while the founder does it: three states, each a title and
  // the line under it.
  "setup.connect.what": ["After you add it", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.stage.reserved": ["Your address is reserved", { slots: {}, fixedBy: "SPEC §5 2026-09-20" }],
  "setup.connect.stage.reserved.line": [
    "Nobody else can take it.",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],
  "setup.connect.stage.waiting": ["We look for the setting", { slots: {}, fixedBy: "SPEC §5 2026-09-20" }],
  "setup.connect.stage.waiting.line": [
    "On our own every hour, and whenever you press check now.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],
  "setup.connect.stage.live": ["Your first page goes live", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.stage.live.line": [
    "On its day, once the setting is found.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],

  // How the address connects: the founder's site, the one setting, the pages.
  "setup.connect.how.title": ["How it connects", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.site": ["Your website", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.site.line": ["Stays exactly as it is.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.setting": ["One setting, added once", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.yours": ["your part", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.setting.line": ["Where your web address is managed. We show you what to copy.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.live": ["Your pages, live", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.how.live.line": ["On your own web address. We run it for you.", { slots: {}, fixedBy: "board Setup · issue 1738" }],

  // The record, as three rows to copy, and the steps behind one press.
  "setup.connect.record.title": ["Copy this where {domain} is managed", { slots: { domain: "text" }, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.record.usually": ["Usually the company you bought the address from.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  /** A copy button's name: `{field}` is the row's own label. */
  "setup.connect.record.copy": ["Copy {field}", { slots: { field: "text" }, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps": ["Show the steps", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps.1": ["Sign in where your web address is managed.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps.2": ["Open its DNS settings and choose to add a record.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps.3": ["Pick the type CNAME, then paste the name and the value above.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps.4": ["Save. Come back here and press I’ve added it, check now.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.steps.guide": ["Step by step for the company that manages your web address", { slots: {}, fixedBy: "board Setup · issue 1738" }],

  // The press and its two answers on this screen.
  "setup.connect.check": ["I’ve added it, check now", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.notfound.title": ["Not found yet", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.notfound": [
    "We can’t see the setting yet. A new setting can take a while to reach everyone. We look again on our own every hour, so you can leave this page.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],
  "setup.connect.connected": [
    "Connected. Your first page goes live on its day. There’s nothing more for you to do.",
    { slots: {}, fixedBy: "board Setup · issue 1738" },
  ],

  // The week after setup. No go-live hour: the address is not connected yet (Q11).
  "setup.connect.week.1": ["Every Monday we plan up to 7 pages, new or updated. Never filler.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.week.2": ["Each page goes live on its day, by itself.", { slots: {}, fixedBy: "board Setup · issue 1738" }],
  "setup.connect.week.3": ["You can edit or stop any page before it goes live. You never have to.", { slots: {}, fixedBy: "board Setup · issue 1738" }],

  // SPEC §6, owner D66 (issue 1311): the site step's one question — where
  // the site's buyers are and the language they search in, filled with what
  // was read of the site. Drafted (#759).
  "setup.locale.label": ["Where your buyers are, and the language they search in", { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  "setup.locale.option": ["{country} · {language}", { slots: { country: "text", language: "text" }, fixedBy: "SPEC §6 · D66 · issue 1311" }],
  "setup.place.label": ["The city or area you serve", { slots: {}, fixedBy: "SPEC §6 · D67 · issue 1318" }],
  "setup.place.note": [
    "Leave it empty if you sell across the country or online. A local business is checked where it works.",
    { slots: {}, fixedBy: "SPEC §6 · D67 · issue 1318" },
  ],
  /** Where and in what the founder's answers above are checked: the place, else the country. */
  "setup.place.preview": ["{area} · in {language}", { slots: { area: "text", language: "text" }, fixedBy: "SPEC §5 · board Setup1 · issue 1737" }],
  "setup.place.preview.line": [
    "We check what buyers here search and ask AI, and who they find instead of you.",
    { slots: {}, fixedBy: "SPEC §5 · board Setup1 · issue 1737" },
  ],
  "setup.locale.note": [
    "Read from your site. Your pages are written in that language.",
    { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1311" },
  ],
}) satisfies CopyPartition;
