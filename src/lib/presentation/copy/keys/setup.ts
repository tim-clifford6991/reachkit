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
// **`setup.submit` is "Start", and no sentence on either screen states how
// long anything takes.** §4.3's footer reads "Start — first page in ~3
// minutes", and REQ-025 c1 reads "nothing on the screen states how long the
// deep pass, or the founder's first page, will take". The two contradict
// each other; the owner ruled on 2026-09-06 (this PR) that **REQ-025 c1
// wins** and §4.3's footer is amended under #2. So the control keeps the
// verb and drops the promise, and the absence is asserted rather than
// reviewed: `tests/app/setup/screen.test.tsx` and `waiting.test.tsx` scan
// the whole rendered tree — the submit included — for a duration, an
// estimate, a countdown, a clock or a percentage, and each carries a
// mutation check proving the scan still catches one.
//
// The two publishing *mode* names are not here: §4.3's "Autopilot" and
// "Copilot" are already `shell.publishing.mode.*` in `laws.ts`, which the
// app shell renders on every screen. One word, one key, both surfaces.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the master's drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const SETUP_COPY = Object.freeze({
  // ── The screen ──────────────────────────────────────────────────────
  "setup.head": ["Three decisions, then we start.", { slots: {}, fixedBy: "REQ-025 c1" }],
  /** REQ-025 c5's exception in one line: a founder whose account cannot be
   *  read is told so, and told they can still reach Settings, cancel and
   *  export with setup unfinished. */
  "setup.refused.no-access": ["We couldn’t find an active plan for this account, so setup can’t start. Settings is still open to you — cancel or export your content there at any time.", { slots: {}, fixedBy: "REQ-025 c5" }],
  /**
   * §4.3's footer control, with its estimate — the C1 resolution, applied.
   *
   * The duration was removed on 2026-09-06 under REQ-025 c1 ("the control
   * reads 'Start'"), and the approved set of 2026-09-08 draws it back:
   * "Start — first page in ~3 minutes." #378 resolved the two as C1 — the
   * approved string stands (11a, and it is the newer owner approval), and
   * REQ-025 c1 is amended to allow a stated estimate — and wrote it into
   * BUILD §4.3, where this value now agrees with the spec again.
   */
  "setup.submit": [
    "Start — first page in ~3 minutes.",
    { slots: {}, fixedBy: "REQ-025 c1 (amended, C1) · S10 (11a)" },
  ],

  // ── The progress strip (UI-SPEC S10 · S11, issue #356) ──────────────
  "setup.progress.paid": ["Paid", { slots: {}, fixedBy: "S10 · 11a" }],
  "setup.progress.setup": ["Setup", { slots: {}, fixedBy: "S10 · 11a" }],
  "setup.progress.first-page": ["First page", { slots: {}, fixedBy: "S10 · 11a" }],

  // ── The two arms' own lines (UI-SPEC S10, issue #356) ───────────────
  "setup.address.assurance": [
    "The site we measure and publish for. Nothing is taken from the address you paid with.",
    { slots: {}, fixedBy: "S10 · REQ-021 c7" },
  ],
  "setup.market.awaiting-site": [
    "Suggested once your site is given.",
    { slots: {}, fixedBy: "S10 · REQ-026 c1" },
  ],
  "setup.site-and-market.title": [
    "Your site & market",
    { slots: {}, fixedBy: "S10 · REQ-021 c6" },
  ],
  "setup.competitors.add.placeholder.first": [
    "rival.com",
    { slots: {}, fixedBy: "S10 · REQ-026 c3" },
  ],
  "setup.mode.default": ["default", { slots: {}, fixedBy: "S10 · 11a" }],
  "setup.footer.line": [
    "You can reach Settings, cancel or export at any time — finishing setup is not required for that.",
    { slots: {}, fixedBy: "S10 · REQ-021 c10" },
  ],

  // ── The site address (REQ-021) ──────────────────────────────────────
  "setup.address.title": ["Your site", { slots: {}, fixedBy: "REQ-021 c6 · S10 (11a)" }],
  "setup.address.label": ["Your website", { slots: {}, fixedBy: "REQ-021 c7 · S10 (11a)" }],
  "setup.address.placeholder": ["yourdomain.com", { slots: {}, fixedBy: "REQ-021 c7 · S10 (11a)" }],
  /** The line beside an address a completed report measured — shown to
   *  confirm or change, never retyped (REQ-021 c6). */
  "setup.address.measured": ["The site your report measured. Keep it, or change it.", { slots: {}, fixedBy: "REQ-021 c6" }],
  "setup.address.change": ["Change", { slots: {}, fixedBy: "REQ-021 c6 · S10 (11a)" }],
  "setup.address.refused.not-a-domain": ["That isn’t a domain. Enter one like yourdomain.com.", { slots: {}, fixedBy: "REQ-021 c9" }],
  /** REQ-021 c9 and c10 in one line: it says the address cannot be
   *  reached, names one way to reach a person, and tells the founder they
   *  can cancel without finishing setup. */
  "setup.address.refused.unreachable": ["We can’t reach that domain. Check the spelling, or write to hello@reachkit.app and a person will help. You can cancel from Settings without finishing setup.", { slots: {}, fixedBy: "REQ-021 c10" }],
  "setup.address.missing": ["Your site address is needed before setup can start.", { slots: {}, fixedBy: "REQ-021 c7" }],

  // ── Your market (REQ-026) ───────────────────────────────────────────
  "setup.market.title": ["Your market", { slots: {}, fixedBy: "REQ-026 c1" }],
  "setup.market.change": ["Change", { slots: {}, fixedBy: "REQ-026 c1" }],
  /** REQ-026 c3: the empty card asks them to state their market in their
   *  own words, with nothing pre-filled and nothing presented as inferred. */
  "setup.market.state-it": ["State your market in a few words.", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.label": ["Your market, in your words", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.placeholder": ["payroll software for small teams", { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.missing": ["Your market is needed to start.", { slots: {}, fixedBy: "REQ-026 c5" }],

  // ── Competitors (REQ-026) ───────────────────────────────────────────
  "setup.competitors.title": ["Competitors", { slots: {}, fixedBy: "REQ-026 c7" }],
  /** REQ-026 c10, first limb: waiting on the market, never "none found". */
  "setup.competitors.awaiting-market": ["Suggested once your market is stated.", { slots: {}, fixedBy: "REQ-026 c10" }],
  "setup.competitors.seeking": ["Looking for rivals in your market…", { slots: {}, fixedBy: "REQ-026 c10" }],
  /** REQ-026 c10, second limb: a known market whose suggestions came back
   *  empty. */
  "setup.competitors.none-found": [
    "No rivals could be suggested for this market yet. Add up to five, or continue without — ReachKit finds them as it measures.",
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
  "setup.competitors.refused.not-a-domain": ["That isn’t a domain. Enter one like rival.com.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.does-not-resolve": ["That domain doesn’t resolve. Check the spelling.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.own-domain": ["That’s your own site, not a rival.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.already-present": ["That domain is already in your set.", { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.set-full": ["Your set is full. Remove a rival to add another.", { slots: {}, fixedBy: "REQ-026 c9" }],

  // ── Destination (REQ-028) ───────────────────────────────────────────
  // No mode pair and no mode title (SPEC §7, #476): the card is headed with
  // `settings.publishing.title`.
  "setup.destination.hosted.name": ["Hosted blog", { slots: {}, fixedBy: "REQ-028 c2" }],
  "setup.destination.hosted": ["a blog on your own domain, served by us", { slots: {}, fixedBy: "REQ-028 c2" }],
  "setup.destination.wordpress.name": ["WordPress", { slots: {}, fixedBy: "REQ-028 c3" }],
  "setup.destination.wordpress": [
    "connect later, ask me after the first page",
    { slots: {}, fixedBy: "REQ-028 c3 · S10 (11a)" },
  ],
  /** The caption over the record itself. The record's three values are
   *  data and carry no key. */
  "setup.destination.dnsRecord": ["Add this record at your DNS provider", { slots: {}, fixedBy: "REQ-028 c2" }],
  /** Issue 759 (owner ruling 2026-09-16): where that provider is — beside
   *  the record on `/setup` and in Settings. Since issue 760 it is the
   *  fallback for a lookup that could not answer. */
  "setup.destination.dnsWhere": [
    "Add it wherever your domain’s DNS is managed — usually your registrar, or Cloudflare if your domain is on it.",
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
    "Your DNS is managed at {provider}. Add this record there.",
    { slots: { provider: "text" }, fixedBy: "SPEC §5 (2026-09-16, issue 760)" },
  ],
  "setup.destination.dnsNameserver": [
    "Your DNS is served by {nameserver}. Add this record wherever that nameserver is managed.",
    { slots: { nameserver: "text" }, fixedBy: "SPEC §5 (2026-09-16, issue 760)" },
  ],
  /** Issue 856 (owner 2026-09-17): one instruction, not a choice. A proxied
   *  record did verify for `content.reachkit.app` on 2026-09-16, but a
   *  hosted custom domain behind Cloudflare's proxy commonly fails its
   *  certificate, and "either works, try the other if not" left the
   *  founder to choose. DNS only is the instruction; the reason is one
   *  line. Shown only on Cloudflare. */
  "setup.destination.dnsProxy": [
    "Set Proxy status to DNS only — the grey cloud. With Cloudflare’s proxy on, the secure certificate for this address often can’t be issued and the connection won’t verify.",
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
  "setup.destination.dnsPending": ["DNS record shown once your site is given.", { slots: {}, fixedBy: "REQ-028 c2" }],

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
  "setup.destination.check.address-unsaved": ["Confirm your site address first — this record is for the address ReachKit has.", { slots: {}, fixedBy: "SPEC §5 (2026-09-16, issue 757)" }],

  // ── The waiting screen (REQ-029) ────────────────────────────────────
  "setup.waiting.head": ["Your first page is on its way.", { slots: {}, fixedBy: "REQ-029 c1" }],
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
    "Measuring your market",
    { slots: {}, fixedBy: "S11 · 11a · REQ-029 c1" },
  ],
  "setup.waiting.stage.sizing-your-rivals": [
    "Sizing your rivals",
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
  /** A finished row's elapsed time, in the numeral face. Whole seconds:
   *  the set prints "41 s", and the pass records instants a second apart
   *  at best. */
  "setup.waiting.stage.elapsed": [
    "{seconds} s",
    { slots: { seconds: "text" }, fixedBy: "S11 · 11a" },
  ],
  /** The running row's own time. The set draws a dash rather than a clock,
   *  and nothing on this screen ticks. */
  "setup.waiting.stage.running": ["–", { slots: {}, fixedBy: "S11 · 11a" }],
  /** A degraded pass still releases setup (§4.3); the founder is told so
   *  on the screen they arrive at, not only at the moment of release. */
  "setup.waiting.degraded": ["The pass couldn’t measure everything. You’re going into the app all the same — what was measured is shown, and the rest is marked as not measured.", { slots: {}, fixedBy: "REQ-029 c3" }],
  /** S11's own two lines, both unbracketed in the set (11a). */
  "setup.waiting.about": [
    "About three minutes. When it finishes you land in the app with the first page already on the calendar. If it finds nothing worth writing, it says so — it never invents a page.",
    { slots: {}, fixedBy: "S11 · 11a" },
  ],
  "setup.waiting.close-tab": [
    "You can close this tab; the sign-in link in your mail brings you back.",
    { slots: {}, fixedBy: "S11 · 11a" },
  ],

  // ── No stated time zone yet (issue 753) ─────────────────────────────
  //
  // Where a founder who finished setup lands while their site has no zone:
  // the app draws every date in the site's own zone and never in the
  // server's (REQ-073 c1), so it cannot open yet. The browser reports its
  // zone from this screen and the founder is taken on to the app. Drafted
  // and shipped under the owner ruling of 2026-09-16 (#759); the owner
  // corrects the wording.
  "setup.zone.head": ["Setting your time zone.", { slots: {}, fixedBy: "issue 753" }],
  "setup.zone.line": ["ReachKit shows every date in your own time zone, so it needs yours before the app opens. Your browser is telling us now.", { slots: {}, fixedBy: "issue 753" }],

  // ── Your voice (SPEC.md §5, 2026-09-12; renamed 2026-09-17, issue 839) ─
  //
  // §5's "The site profile is confirmed here": the page inventory and the
  // site name are shown as read, and the brand-voice summary is shown and
  // editable before anything is written. Every sentence below is the
  // owner's and unwritten today, so each lands as the renderable
  // `TODO(copy)` marker rather than a sentence composed here — the
  // artboard (`docs/design/canvas/OnboardingMarket.dc.html`) carries the
  // same lines as bracketed placeholders.
  //
  // The eight purpose words are keys and not raw tokens for the same
  // reason the band words are: `pricing` is an identifier the engine
  // classifies by, and what a customer reads beside a count is a word the
  // owner chooses.
  // The owner's own name for the section (issue 839): the key is kept so
  // nothing that reads it churns.
  "setup.profile.title": ["Your voice", { slots: {}, fixedBy: "issue 839" }],
  /** The head's pill. `{pages}` is the inventory's own row count — what
   *  was read, never a target or a promise. */
  "setup.profile.pages-read": [
    "{pages} pages read",
    { slots: { pages: "text" }, fixedBy: "SPEC.md §5 (2026-09-12)" },
  ],
  "setup.profile.site-name": ["Site name", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** The line above the purpose chips — what each page is for. */
  "setup.profile.purposes": ["What these pages are for", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  "setup.profile.voice.label": ["Brand voice", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** Above an empty voice box, where no voice has been read of the site
   *  yet — the free scan does not read one, and the deep pass that does
   *  runs after this submit. Drafted under the owner ruling of 2026-09-16
   *  (issue 759); the owner corrects the wording. */
  "setup.profile.voice.unread": [
    "ReachKit has not read your voice yet. Describe how your site sounds — who it speaks to, the words it uses, the claims it makes — or leave this empty and ReachKit reads it from your pages after you finish setup.",
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
  "setup.release.unmeasured": ["Your first measurement fell short in places. What was measured is shown with its date; the rest is marked as not measured until the next pass fills it in.", { slots: {}, fixedBy: "REQ-029 c3" }],
  /** REQ-029 c5: the pass failed outright, or had not ended when the
   *  founder was released anyway. One sentence saying the measurement did
   *  not complete — never that it found nothing, which is a different
   *  fact with its own line (§7). */
  "setup.release.incomplete": ["Your first measurement didn’t complete. Nothing is needed from you — the next measurement fills it in.", { slots: {}, fixedBy: "REQ-029 c5" }],
  /** Issue #770: the pass read the market and found too few searches to
   *  plan a page from — a measurement, not a failure. Issue 837 (owner,
   *  2026-09-17): it points at the choice beside it, never at a week. */
  "setup.release.market-too-small": ["We couldn’t find enough searches for your market to plan pages yet. Pick a broader category and we’ll measure your market again right away.", { slots: {}, fixedBy: "issue 770" }],

  // Issue 837 (owner ruling 2026-09-17): the choice a thin market offers —
  // two or three broader categories from the site's own profile, and the
  // founder's own words — and the two ways a press is refused. Drafted under
  // issue 759's ruling; the owner corrects the wording.
  "setup.remeasure.suggested": ["Broader categories to try", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.own": ["Or describe your market in your own words", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.submit": ["Measure again now", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.empty": ["Type a category, or pick one of the suggestions.", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.running": ["Your market is already being measured. Your pages follow as soon as it finishes.", { slots: {}, fixedBy: "issue 837" }],
  "setup.remeasure.refused.daily-limit": ["You’ve measured your market as many times as a day allows. You can measure again after {time}.", { slots: { time: "text" }, fixedBy: "issue 837" }],
}) satisfies CopyPartition;
