// BUILD §2.5 — setup's sentences.
// src/lib/presentation/copy/keys/setup.ts — BP-020 decision 5, WO-041
//
// Setup's sentences. Seeded empty by WO-041; filled by issue #14, the block
// that owns §4.3.
//
// **Two mechanisms, both live, and this file uses only one of them.** A key
// whose value is `''` lands in `OWNER_OWED` and `copy()` throws for it —
// right for a key nothing renders yet, wrong for a screen where every line
// is unwritten, because one throw takes the whole screen down and hides the
// finished modules from the review the owner needs in order to write the
// missing sentences. So every unwritten key here carries `TODO(copy)`, the
// marker `CLAUDE.md` names: it renders as itself, visibly unwritten in
// place, and stays countable.
//
// **Six keys carry a real value, and every one is a transcription of a word
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
import type { CopyPartition } from "../registry.ts";

// The marker `CLAUDE.md` fixes for a key whose sentence the owner has not
// written yet. Deliberately a local `const` and **not** exported: this file
// is a partition, and `registry.test.ts` reads a partition module's single
// export as the partition itself. `TODO_COPY_MARKER` is declared once in
// `registry.ts` — which is where `AWAITING_COPY` is derived from it — and
// the two literals are asserted equal there rather than imported across the
// value cycle a partition importing `registry.ts` for a value would close.
const TODO = "TODO(copy)";

export const SETUP_COPY = Object.freeze({
  // ── The screen ──────────────────────────────────────────────────────
  "setup.head": [TODO, { slots: {}, fixedBy: "REQ-025 c1" }],
  /** REQ-025 c5's exception in one line: a founder whose account cannot be
   *  read is told so, and told they can still reach Settings, cancel and
   *  export with setup unfinished. */
  "setup.refused.no-access": [TODO, { slots: {}, fixedBy: "REQ-025 c5" }],
  /** §4.3's footer verb, with the duration the owner removed on
   *  2026-09-06 (REQ-025 c1 wins; §4.3's footer amended under #2). */
  "setup.submit": ["Start", { slots: {}, fixedBy: "REQ-025 c1" }],

  // ── The site address (REQ-021) ──────────────────────────────────────
  "setup.address.title": [TODO, { slots: {}, fixedBy: "REQ-021 c6" }],
  "setup.address.label": [TODO, { slots: {}, fixedBy: "REQ-021 c7" }],
  "setup.address.placeholder": [TODO, { slots: {}, fixedBy: "REQ-021 c7" }],
  /** The line beside an address a completed report measured — shown to
   *  confirm or change, never retyped (REQ-021 c6). */
  "setup.address.measured": [TODO, { slots: {}, fixedBy: "REQ-021 c6" }],
  "setup.address.change": [TODO, { slots: {}, fixedBy: "REQ-021 c6" }],
  "setup.address.refused.not-a-domain": [TODO, { slots: {}, fixedBy: "REQ-021 c9" }],
  /** REQ-021 c9 and c10 in one line: it says the address cannot be
   *  reached, names one way to reach a person, and tells the founder they
   *  can cancel without finishing setup. */
  "setup.address.refused.unreachable": [TODO, { slots: {}, fixedBy: "REQ-021 c10" }],
  "setup.address.missing": [TODO, { slots: {}, fixedBy: "REQ-021 c7" }],

  // ── Your market (REQ-026) ───────────────────────────────────────────
  "setup.market.title": ["Your market", { slots: {}, fixedBy: "REQ-026 c1" }],
  "setup.market.change": ["Change", { slots: {}, fixedBy: "REQ-026 c1" }],
  /** REQ-026 c3: the empty card asks them to state their market in their
   *  own words, with nothing pre-filled and nothing presented as inferred. */
  "setup.market.state-it": [TODO, { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.label": [TODO, { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.placeholder": [TODO, { slots: {}, fixedBy: "REQ-026 c3" }],
  "setup.market.missing": [TODO, { slots: {}, fixedBy: "REQ-026 c5" }],

  // ── Competitors (REQ-026) ───────────────────────────────────────────
  "setup.competitors.title": ["Competitors", { slots: {}, fixedBy: "REQ-026 c7" }],
  /** REQ-026 c10, first limb: waiting on the market, never "none found". */
  "setup.competitors.awaiting-market": [TODO, { slots: {}, fixedBy: "REQ-026 c10" }],
  "setup.competitors.seeking": [TODO, { slots: {}, fixedBy: "REQ-026 c10" }],
  /** REQ-026 c10, second limb: a known market whose suggestions came back
   *  empty. */
  "setup.competitors.none-found": [TODO, { slots: {}, fixedBy: "REQ-026 c10" }],
  /** REQ-026 c9: the limit is stated on screen rather than silently
   *  enforced. `{max}` is `BATTERY.COMPETITORS_MAX`. */
  "setup.competitors.limit": [TODO, { slots: { max: "text" }, fixedBy: "REQ-026 c9" }],
  "setup.competitors.add.label": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.add.placeholder": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.add.action": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.remove": [TODO, { slots: {}, fixedBy: "REQ-026 c7" }],
  "setup.competitors.refused.not-a-domain": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.does-not-resolve": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.own-domain": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.already-present": [TODO, { slots: {}, fixedBy: "REQ-026 c8" }],
  "setup.competitors.refused.set-full": [TODO, { slots: {}, fixedBy: "REQ-026 c9" }],

  // ── Mode + destination (REQ-028) ────────────────────────────────────
  "setup.publishing.title": [TODO, { slots: {}, fixedBy: "REQ-028 c1" }],
  /** REQ-028 c1: one written line each — pages publish after a review
   *  window they can stop, versus only when they approve. */
  "setup.mode.autopilot": [TODO, { slots: {}, fixedBy: "REQ-028 c1" }],
  "setup.mode.copilot": [TODO, { slots: {}, fixedBy: "REQ-028 c1" }],
  "setup.destination.hosted.name": ["Hosted blog", { slots: {}, fixedBy: "REQ-028 c2" }],
  "setup.destination.hosted": [TODO, { slots: {}, fixedBy: "REQ-028 c2" }],
  "setup.destination.wordpress.name": ["WordPress", { slots: {}, fixedBy: "REQ-028 c3" }],
  "setup.destination.wordpress": [TODO, { slots: {}, fixedBy: "REQ-028 c3" }],
  /** The caption over the record itself. The record's three values are
   *  data and carry no key. */
  "setup.destination.dnsRecord": [TODO, { slots: {}, fixedBy: "REQ-028 c2" }],
  /** REQ-028 c2: the written line that stands where the record will sit
   *  until a site address is given — never a blank, dash or placeholder. */
  "setup.destination.dnsPending": [TODO, { slots: {}, fixedBy: "REQ-028 c2" }],

  // ── The waiting screen (REQ-029) ────────────────────────────────────
  "setup.waiting.head": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  /** One line per stage of the pass. Which step is under way, in written
   *  words — never a bare spinner, and never how long. */
  "setup.waiting.stage.reading_your_site": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  "setup.waiting.stage.reading_access_rules": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  "setup.waiting.stage.reading_your_market": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  "setup.waiting.stage.checking_your_presence": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  "setup.waiting.stage.asking_the_twelve": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  "setup.waiting.stage.scoring": [TODO, { slots: {}, fixedBy: "REQ-029 c1" }],
  /** A degraded pass still releases setup (§4.3); the founder is told so
   *  on the screen they arrive at, not only at the moment of release. */
  "setup.waiting.degraded": [TODO, { slots: {}, fixedBy: "REQ-029 c3" }],

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
  "setup.release.unmeasured": [TODO, { slots: {}, fixedBy: "REQ-029 c3" }],
  /** REQ-029 c5: the pass failed outright, or had not ended when the
   *  founder was released anyway. One sentence saying the measurement did
   *  not complete — never that it found nothing, which is a different
   *  fact with its own line (§7). */
  "setup.release.incomplete": [TODO, { slots: {}, fixedBy: "REQ-029 c5" }],
}) satisfies CopyPartition;
