/**
 * MOCK DATA. Nothing here reaches the outside — no network call, no vendor
 * SDK, no database. Every screen in this app is fed from this file.
 *
 * THE COPY CONVENTION, carried over from the four HTML sheets:
 *
 *   [thing — owner's]   a customer-visible sentence only the owner may
 *                       write (constitution §1: customer-visible strings).
 *                       It is NOT drafted here, not even as a suggestion.
 *   [thing]             a data identity or a value a caller supplies at
 *                       runtime — a domain, a rival, a date, an address.
 *   bare words          transcribed verbatim from an approved artifact and
 *                       marked as such in the sheet that uses them. The
 *                       five stage names are REQ-043 criterion 2; the three
 *                       destinations are BUILD §4.4 / BP-037; the five "why
 *                       this page" keys are BUILD §4.6.
 *
 * Numbers are shaped, not measured: they exist so a layout can be judged at
 * real length. None of them is a claim about anything (rule 1.2 — never
 * invent a measurement; these are not presented as measurements, they are
 * presented as a specimen's dimensions, inside a preview labelled as one).
 */

/* ── transcribed, not invented ──────────────────────────────────────────── */
export const STAGES = ["Live", "Your review", "Scheduled", "Planned", "Needs you"] as const;
export const DESTINATIONS = ["Overview", "Calendar", "Settings"] as const;
export const WHY_KEYS = ["search", "asked", "answered today by", "you", "done when"] as const;

/* ── report ─────────────────────────────────────────────────────────────── */
export const REPORT = {
  domain: "[domain]",
  measuredAt: "[measured · date]",
  category: "[category]",
  score: "62",
  band: "[band]",
  drivers: [
    { label: "[driver 1]", value: 7, max: 10 },
    { label: "[driver 2]", value: 4, max: 10 },
    { label: "[driver 3]", value: 9, max: 10 },
  ],
  aiSourceChip: "[source chip · date]",
  denominator: "[denominator line — owner's]",
  methodChip: "[method chip — owner's]",
  questions: [
    { n: 1, q: "[question 1]", from: "[search]", vol: "1,900/mo", named: "[brands]" },
    { n: 2, q: "[question 2]", from: "[search]", vol: "1,300/mo", named: "[brands]" },
    { n: 3, q: "[question 3]", from: "[search]", vol: "880/mo", named: "[brands]" },
    { n: 4, q: "[question 4]", from: "[search]", vol: "720/mo", named: "[brands]" },
  ],
  notYouBadge: "[not you]",
  showAll: "[show all 12 — owner's]",
  googleSourceChip: "[source chip · 12 biggest searches]",
  presence: [
    { name: "[rival 1]", value: 9, you: false },
    { name: "[rival 2]", value: 7, you: false },
    { name: "[rival 3]", value: 5, you: false },
    { name: "[rival 4]", value: 3, you: false },
    { name: "[you]", value: 0, you: true },
  ],
  absent: [
    ["[search]", "2,400/mo", "[rival 1]"],
    ["[search]", "1,600/mo", "[rival 2]"],
    ["[search]", "1,300/mo", "[rival 1]"],
    ["[search]", "890/mo", "[rival 3]"],
    ["[search]", "540/mo", "[rival 2]"],
  ],
  absentEmpty: "[absent-table empty line — owner's]",
  footnoteF4: "[market-total footnote — owner's]",
  problems: [
    { title: "[problem 1 title — owner's]", badge: "[free fix badge — owner's]", tone: "ok" as const },
    { title: "[problem 2 title — owner's]", badge: "[writes badge — owner's]", tone: "accent" as const },
    { title: "[problem 3 title — owner's]", badge: "[rewrites badge — owner's]", tone: "accent" as const },
  ],
  robotsLines: [
    "# [robots lines — verbatim, from REQ-009 c2]",
    "# not drafted in a preview; the approved requirement holds them",
  ],
  copyLabel: "[copy label — owner's]",
  diy: [
    "[DIY collapse 1 summary — owner's]",
    "[DIY collapse 2 summary — owner's]",
    "[DIY collapse 3 summary — owner's]",
  ],
  diyBody: "[DIY instructional body — owner's. §4.1 module 4 allows instructional text here; a preview still does not write it]",
  freePage: {
    title: "[page 1 title]",
    rows: [
      { k: "target", v: "[search] · 2,400/mo" },
      { k: "beats", v: "[rival 1]" },
      { k: "format", v: "[format]" },
    ],
    cta: "[email-me CTA — owner's]",
    ofN: "[page 1 of N line — owner's]",
  },
  pricing: {
    price: "€49",
    per: "[per month — owner's]",
    specs: ["[spec 1 — owner's]", "[spec 2 — owner's]", "[spec 3 — owner's]", "[spec 4 — owner's]"],
    cta: "[start CTA — owner's]",
    cancel: "[cancel line — owner's]",
  },
  scanning: [
    { label: "[stage 1]", state: "done" as const },
    { label: "[stage 2]", state: "done" as const },
    { label: "[stage 3]", state: "active" as const },
    { label: "[stage 4]", state: "pending" as const },
  ],
  degradedLine: "[missing-driver line — owner's]",
  cooldownLine: "[cooldown line — owner's]",
  retryLabel: "[retry label — owner's]",
};

/* ── the dot matrix ─────────────────────────────────────────────────────── */
export const MATRIX_ROWS = [
  {
    identity: "rival" as const,
    name: "[rival 1]",
    cells: [
      { label: "[q1]", state: "cited" as const },
      { label: "[q2]", state: "cited" as const },
      { label: "[q3]", state: "not-cited" as const },
      { label: "[q4]", state: "cited" as const },
      { label: "[q5]", state: "cited" as const },
      { label: "[q6]", state: "muted" as const },
      { label: "[q7]", state: "cited" as const },
      { label: "[q8]", state: "not-cited" as const },
      { label: "[q9]", state: "cited" as const },
    ],
  },
  {
    identity: "rival" as const,
    name: "[rival 2]",
    cells: [
      { label: "[q1]", state: "cited" as const },
      { label: "[q2]", state: "not-cited" as const },
      { label: "[q3]", state: "cited" as const },
      { label: "[q4]", state: "cited" as const },
      { label: "[q5]", state: "not-cited" as const },
      { label: "[q6]", state: "muted" as const },
      { label: "[q7]", state: "cited" as const },
      { label: "[q8]", state: "cited" as const },
      { label: "[q9]", state: "not-cited" as const },
    ],
  },
  {
    identity: "you" as const,
    name: "[you]",
    cells: [
      { label: "[q1]", state: "not-cited" as const },
      { label: "[q2]", state: "not-cited" as const },
      { label: "[q3]", state: "not-cited" as const },
      { label: "[q4]", state: "not-cited" as const },
      { label: "[q5]", state: "not-cited" as const },
      { label: "[q6]", state: "muted" as const },
      { label: "[q7]", state: "not-cited" as const },
      { label: "[q8]", state: "not-cited" as const },
      { label: "[q9]", state: "not-cited" as const },
    ],
  },
];

/* ── overview ───────────────────────────────────────────────────────────── */
export const GROWTH = [
  { label: "wk 1", date: "[date]", value: 12 },
  { label: "wk 2", date: "[date]", value: 31 },
  { label: "wk 3", date: "[date]", value: 44 },
  { label: "wk 4", date: "[date]", value: 61 },
  { label: "wk 5", date: "[date]", value: 96 },
  { label: "wk 6", date: "[date]", value: 128 },
];

export const GROWTH_GAPPED = [
  { label: "wk 1", date: "[date]", value: 12 },
  { label: "wk 2", date: "[date]", value: 31 },
  { label: "wk 3", date: "[date]", value: null },
  { label: "wk 4", date: "[date]", value: 61 },
  { label: "wk 5", date: "[date]", value: 96 },
  { label: "wk 6", date: "[date]", value: 128 },
];

export const RIVALS = [
  { name: "[rival 1]", series: [276, 240, 190, 150, 110, 78], endpoint: "78×", delta: "was 276×" },
  { name: "[rival 2]", series: [180, 165, 140, 120, 96, 61], endpoint: "61×", delta: "was 180×" },
  { name: "[rival 3]", series: [90, 84, 70, 61, 50, 44], endpoint: "44×", delta: "was 90×" },
];

export const WEEK = [
  { date: "26", state: "done" as const, label: "[done]" },
  { date: "27", state: "done" as const, label: "[done]" },
  { date: "28", state: "unmeasured" as const, label: "[nothing measured]" },
  { date: "29", state: "done" as const, label: "[done]" },
  { date: "30", state: "done" as const, label: "[done]" },
  { date: "01", state: "today" as const, label: "[today]" },
  { date: "02", state: "to-come" as const, label: "[to come]" },
];

export const OVERVIEW = {
  head: "[overview head — owner's]",
  headBadge: "[every-week badge — owner's]",
  growthLabel: "[module label]",
  growthStart: "[start value]",
  growthGoal: "[goal footnote — owner's]",
  growthNoMeasurement: "[no-measurement line — owner's]",
  growthFirstDue: "[first due · date]",
  tiles: {
    score: { label: "[tile label]", value: "62", delta: "▲ 8" },
    ai: { label: "[tile label]", value: "2", goal: "[goal label]" },
    pages: { label: "[tile label]", value: "17", extra: "[ranking line — owner's]", young: "[too-early line — owner's]" },
  },
  rivalsLabel: "[module label]",
  rivalsDim: "[gap-shrinking line — owner's]",
  weekLabel: "[module label]",
  openCalendar: "[open calendar — owner's]",
  alerts: [
    { tone: "warn" as const, message: "[veto-pending alert — owner's]", action: "[read it — owner's]" },
    { tone: "warn" as const, message: "[needs-you alert — owner's]", action: "[reconnect — owner's]" },
  ],
  emptyQueue: "[empty-queue line — owner's]",
  reMeasuring: "[re-measuring line — owner's]",
  lastMeasurement: "[last good measurement · date]",
  failedMeasurement: "[measurement failed line — owner's]",
};

/* ── shell ──────────────────────────────────────────────────────────────── */
export const SHELL = {
  domain: "[domain]",
  week: "[week n · re-measured mon]",
  counts: { Calendar: 28 },
  publishing: {
    state: "[publishing state]",
    next: "[next publish · time]",
    toggleLabel: "[autopilot toggle label — owner's]",
  },
};

/* ── calendar ───────────────────────────────────────────────────────────── */
export const CALENDAR = {
  head: "[calendar head — owner's]",
  month: "[month]",
  prev: "[prev]",
  next: "[next]",
  filters: [
    { label: "[all]", count: 28, tone: "accent" as const },
    { label: "Live", count: 11, tone: "ok" as const },
    { label: "Your review", count: 1, tone: "warn" as const },
    { label: "Scheduled", count: 6, tone: "neutral" as const },
    { label: "Planned", count: 9, tone: "neutral" as const },
    { label: "Needs you", count: 1, tone: "warn" as const },
  ],
  footnote: "[planned-pages footnote — owner's]",
  exhausted: "[exhausted-supply line — owner's]",
  cause: "[cause line — owner's]",
  instruction: "[instruction — owner's]",
  emptyDayLabel: "[empty-day label]",
  waysLabel: "[ways-through label — owner's]",
  route1: "[route 1 label — owner's]",
  route2: "[route 2 label — owner's]",
  addressKeyReadable: "[address label · readable-at — owner's]",
  addressKeyInWordpress: "[address label · in-wordpress — owner's]",
  addressKeyWasPublished: "[address label · was-published-at — owner's]",
  publicAddress: "[public address]",
  wordpressAddress: "[wordpress address]",
  leadsNowhere: "[leads-nowhere account — owner's]",
  unpublish: "[unpublish label — owner's]",
  reviewAction: "[review action — owner's]",
  moveLabel: "[move label — owner's]",
  vetoLabel: "[veto label — owner's]",
  skipLabel: "[skip label — owner's]",
  reconnectLabel: "[reconnect label — owner's]",
  pageTitle: "[page title]",
  provenance: "[published · date] · [source]",
  why: [
    { k: "search", v: "[search]" },
    { k: "asked", v: "2,400/mo" },
    { k: "answered today by", v: "[brands]" },
    { k: "you", v: "[you]" },
    { k: "done when", v: "[done-when]" },
  ],
};

/* ── setup ──────────────────────────────────────────────────────────────── */
export const SETUP = {
  head: "[setup head — owner's]",
  market: { label: "[market card head — owner's]", chip: "[category]", change: "[change label — owner's]" },
  competitors: {
    label: "[competitors card head — owner's]",
    suggested: ["[rival 1]", "[rival 2]", "[rival 3]", "[rival 4]", "[rival 5]", "[rival 6]"],
    hint: "[up-to-five line — owner's]",
    empty: "[no-suggestions line — owner's]",
  },
  mode: {
    label: "[mode card head — owner's]",
    autopilot: "[autopilot label — owner's]",
    copilot: "[copilot label — owner's]",
    hostedBlog: "[hosted blog label — owner's]",
    wordpressLater: "[wordpress-later label — owner's]",
    cname: "[cname record]",
    cnameKey: "[cname key — owner's]",
  },
  submit: "[submit — owner's]",
  progress: [
    { label: "[stage 1]", state: "done" as const },
    { label: "[stage 2]", state: "active" as const },
    { label: "[stage 3]", state: "pending" as const },
  ],
  degraded: "[degraded-pass line — owner's]",
  zeroProposals: "[zero-proposals line — owner's]",
};

/* ── draft ──────────────────────────────────────────────────────────────── */
export const DRAFT = {
  back: "[back to calendar — owner's]",
  title: "[page title]",
  claimBadge: "[claim-check badge — owner's]",
  groundedLine: "[grounded fact — generated, labelled]",
  groundedSource: "[source · date]",
  generatedLabel: "[generated content — labelled per standing law 3]",
  bodyBlocks: [
    "[draft heading — generated]",
    "[draft paragraph — generated. A preview renders the SHAPE of generated content and never a sample of it: filler copy in a preview is the defect rule 7.3 names]",
    "[draft list — generated]",
    "[draft heading — generated]",
    "[draft paragraph — generated]",
  ],
  doNothing: "[what happens if you do nothing — owner's]",
  approve: "[approve — owner's]",
  edit: "[edit — owner's]",
  veto: "[veto — owner's]",
  editorLabel: "[markdown editor label — owner's]",
  editorPlaceholder: "[editor placeholder — owner's]",
  previewLabel: "[live preview label — owner's]",
  autosave: "[autosaved · time]",
  claimDropped: "[claim-check re-running line — owner's]",
};

/* ── the still-outstanding strings, listed on every sheet that needs one ── */
export const OUTSTANDING: readonly { label: string; named: string }[] = [
  { label: "[removal mailbox]", named: "REQ-002 c1 — the address a removal request is sent to" },
  { label: "[removal receipt]", named: "REQ-002 — whether a removal receipt is recorded at all" },
  { label: "[out-of-reach line]", named: "REQ-096 c6" },
  { label: "[wordpress stamp slug]", named: "WORDPRESS_STAMP_SLUG — no value stated anywhere" },
  { label: "[cannot-publish sentence]", named: "ADR-084" },
  { label: "[address label · readable-at / was-published-at]", named: "REQ-056 c6 — the two-key pair" },
];
