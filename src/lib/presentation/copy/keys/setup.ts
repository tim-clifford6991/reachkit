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

  // ── Mode + destination (REQ-028) ────────────────────────────────────
  "setup.publishing.title": ["Mode + destination", { slots: {}, fixedBy: "REQ-028 c1 · S10 (11a)" }],
  /** REQ-028 c1: one written line each — pages publish after a review
   *  window they can stop, versus only when they approve. */
  "setup.mode.autopilot": ["Each page publishes when its veto window ends, unless you stop it.", { slots: {}, fixedBy: "REQ-028 c1" }],
  "setup.mode.copilot": ["Nothing publishes until you approve it.", { slots: {}, fixedBy: "REQ-028 c1" }],
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
  /** REQ-028 c2: the written line that stands where the record will sit
   *  until a site address is given — never a blank, dash or placeholder. */
  "setup.destination.dnsPending": ["DNS record shown once your site is given.", { slots: {}, fixedBy: "REQ-028 c2" }],

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

  // ── Your site, as we read it (SPEC.md §5, 2026-09-12) ───────────────
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
  "setup.profile.title": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** The head's pill. `{pages}` is the inventory's own row count — what
   *  was read, never a target or a promise. */
  "setup.profile.pages-read": ["TODO(copy)", { slots: { pages: "text" }, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  "setup.profile.site-name": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** The line above the purpose chips — what each page is for. */
  "setup.profile.purposes": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  "setup.profile.voice.label": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  /** The note under the voice box: the same text is editable in Settings
   *  afterwards (§5's done-when, 2026-09-12). */
  "setup.profile.voice.later": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §5 (2026-09-12)" }],
  "setup.profile.purpose.pricing": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.about": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.features": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.product": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.blog": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.contact": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.legal": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],
  "setup.profile.purpose.other": ["TODO(copy)", { slots: {}, fixedBy: "SPEC.md §2 (2026-09-12)" }],

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
}) satisfies CopyPartition;
