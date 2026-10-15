// src/lib/presentation/copy/keys/laws.ts — BP-020 decision 5, WO-041
//
// The sentences the cross-cutting laws are made of, which no single surface
// owns: the five stopped-work lines, the five next-publish lines and the
// two generated-page lines (WO-041 step 3). BP-019 decision 6 adds a
// fourth law's three keys later (WO-249); this file seeds only these
// twelve.
//
// 2026-09-04: the owner ruled on three of the twelve (WO-041 `## Log`,
// this date's ruling) — `stopped.work.line`, `stopped.work.needs-nothing`
// and `next-publish.scheduled` — filled verbatim, byte for byte, and no
// longer owner-owed. The remaining nine were not part of this ruling.
//
// 2026-09-04, separately: WO-278 (BP-019 decision 6, WO-249's block) closes
// the fourth cross-cutting law — `law: 'unmeasured'` — with the three keys
// `renderMeasured`'s `unmeasuredLine: CopyKey` argument takes. Two are
// owner-owed and empty (REQ-004 criteria 6 and 9's own written lines are
// the owner's, constitution §1); the third, `unmeasured.dash`, carries a
// value — a transcription of REQ-004's own "—" character, on the same
// footing as the thirteen band words, and the reason no dash literal
// appears anywhere in `src/lib/presentation/`.
//
// 2026-09-04, separately again: WO-287 (owner ruling 2026-09-04, sheet 2 —
// `registry/evidence/RULING-copy-2026-09-04.json`) fills
// `unmeasured.undeterminable` and `unmeasured.not-attempted`, filled
// verbatim, byte for byte; neither is owner-owed any longer. Each declares
// one `what: "text"` slot — the subject that could not be measured — the
// slot the ruled sentence itself takes; `renderMeasured` (BP-019,
// `src/lib/presentation/measured.ts`) gains the matching options member
// to supply it. `unmeasured.dash` is untouched.
//
// 2026-09-05, separately again: issue #9 (BUILD §4.4, REQ-040) adds the
// seven `shell.*` keys the app shell speaks on every app screen — sentences
// no single screen owns, which is why they sit here beside the
// `next-publish.*` family the same shell renders. Two are owner-owed and
// empty (REQ-040 c6's week line and c7's not-measured line are written
// sentences and therefore the owner's, constitution §1). Five carry a
// value, and every one of them is a **transcription** of a word `BUILD.md`
// itself prints, on the same footing as the thirteen band words: §4.4's
// "nav **Overview / Calendar / Settings**" and §4.3's "Autopilot (default,
// selected) vs Copilot". Nothing here is composed.
//
// 2026-09-06, issue #20 (REQ-091/REQ-092): seven values moved from `""` to
// `TODO(copy)` — `stopped.work.resumes-on`, `stopped.work.no-time-promised`,
// `stopped.work.partial-pass` and the four unfilled `next-publish.*` lines.
// The reason is the standing ruling in #93 ("owner-owed copy keys on fixture
// screens render as the visible marker `TODO(copy)`; mail keeps the
// throw"), reached here by REQ-091 c2: a place holding nothing must carry
// **one written line, never a blank**, so an empty value — which `copy()`
// refuses to render — is the one thing these keys may not hold. Still the
// owner's sentences; the owner's words replaced the marker on 2026-09-10
// (below).
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const LAWS_COPY = Object.freeze({
  "stopped.work.line": ["ReachKit stopped its own work today, so no page was written. Nothing about your market changed.", { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c1" }],
  "stopped.work.needs-nothing": [
    "Nothing is needed from you. ReachKit picks up again on its own.",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c2" },
  ],
  "stopped.work.resumes-on": [
    "ReachKit expects to pick up again on {date}.",
    { law: "stopped-work", slots: { date: "date" }, fixedBy: "REQ-092 c4" },
  ],
  "stopped.work.no-time-promised": [
    "No time is promised for the work to resume.",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c4" },
  ],
  "stopped.work.partial-pass": [
    "This page was written from a scan cut short: part of it wasn’t done.",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c6" },
  ],
  "next-publish.stopped": ["ReachKit stopped its own work, so no page is scheduled.", { law: "next-publish", slots: {}, fixedBy: "REQ-092 c7" }],
  "next-publish.scheduled": [
    "Next page goes live {at}",
    { law: "next-publish", slots: { at: "date" }, fixedBy: "REQ-040 c4" },
  ],
  "next-publish.paused": ["Publishing is off.", { law: "next-publish", slots: {}, fixedBy: "REQ-040 c4" }],
  // A page is planned and not written yet (owner 2026-10-09, issue 1362).
  // It replaces the "nothing approved" cause: no customer approves a page.
  // Drafted; the owner corrects it.
  "next-publish.being-written": [
    "The next page is being written.",
    { law: "next-publish", slots: {}, fixedBy: "issue 1362" },
  ],
  "next-publish.none-planned": [
    "No page planned yet.",
    { law: "next-publish", slots: {}, fixedBy: "REQ-040 c4" },
  ],
  // No publish is scheduled and no cause is recorded (SPEC §7, 2026-10-07,
  // issue 1321). Not a stop. Drafted under issue 759's ruling; the owner
  // corrects it.
  "next-publish.unexplained": ["No page is scheduled yet.", { law: "next-publish", slots: {}, fixedBy: "issue 1321" }],
  // 2026-09-06, issue #17: value moved from "" to `TODO(copy)`, on exactly
  // the footing the sibling key below records for 2026-09-05. §4.6's draft
  // view renders a *written* page's body, which is model text and therefore
  // reaches the screen only through `renderGenerated` — and
  // `renderGenerated` resolves this key for the label that must ride with
  // it (REQ-093 c2). Left empty, `copy()` throws and the whole draft view
  // goes down; `TODO(copy)` renders as itself, so the label is visibly
  // present and visibly unwritten. Still the owner's sentence; no string is
  // written here. With this, both `generated.page.*` keys are awaiting copy
  // and neither is owner-owed-and-empty.
  // 2026-09-09, issue #377: filled from UI-SPEC S16, which draws the label
  // on the draft's own card head as `generated by ReachKit · labelled` —
  // unbracketed, so approved copy under ruling 11a. The `{pageTitle}` slot
  // stays declared and stays supplied: the set puts the label on the card
  // rather than inside the sentence, so the `{pageTitle}` slot this key
  // declared goes with the marker: a declared slot the sentence never
  // spends is a placeholder nothing substitutes, which
  // `tests/presentation/copy/registry.test.ts` refuses. Callers may still
  // pass the title — `copy()` ignores a var no slot names — and the label
  // rides beside the page it labels, which is what REQ-093 c2 asks.
  "generated.page.written": [
    "generated by ReachKit · labelled",
    { slots: {}, fixedBy: "REQ-093 c2 · S16 (11a)" },
  ],
  // 2026-09-05, issue #13: value moved from "" to `TODO(copy)` per
  // `CLAUDE.md`'s standing rule. The free report's free-page card
  // (`BUILD.md` §4.1 module 5) renders a proposed page's title, which is
  // model text and therefore reaches the screen only through
  // `renderGenerated` — and `renderGenerated` resolves this key for the
  // label that must ride with it. Left empty, `copy()` throws and the
  // whole report screen goes down; `TODO(copy)` renders as itself, so the
  // label is visibly present and visibly unwritten. Still the owner's
  // sentence, written on 2026-09-10 (#460). `generated.page.written` is
  // untouched — no surface renders it yet, and
  // `tests/presentation/generated/text.test.ts` asserts the owner-owed
  // throw against it.
  "generated.page.proposed": [
    "proposed by ReachKit · not yet written · {pageTitle}",
    { slots: { pageTitle: "text" }, fixedBy: "REQ-093 c2" },
  ],
  "unmeasured.undeterminable": ["{what} couldn’t be measured: nothing came back that could be read.", { law: "unmeasured", slots: { what: "text" }, fixedBy: "REQ-004 c6" }],
  "unmeasured.not-attempted": ["{what} wasn’t measured: the scan stopped early, before it got there.", { law: "unmeasured", slots: { what: "text" }, fixedBy: "REQ-004 c9" }],
  "unmeasured.dash": ["—", { law: "unmeasured", slots: {}, fixedBy: "REQ-004 c2" }],
  // The label the screen set draws over the three nav rows, in the eyebrow
  // role (S12, UI-SPEC §2's sidebar row). Approved as written (11a); the
  // uppercase is the role's, not the string's.
  "shell.workspace": ["Workspace", { slots: {}, fixedBy: "S12" }],
  "shell.nav.overview": ["Overview", { slots: {}, fixedBy: "REQ-040 c1" }],
  // SPEC §4 (2026-09-20, #908): "Menu: **Overview · Plan · Settings**" —
  // *Plan* is the calendar's on-screen name, so the destination keeps its
  // address and loses its old word. The key was `shell.nav.calendar`; a
  // renamed key rather than a re-worded one, so nothing can go on speaking
  // "Calendar" from a name that no longer means it.
  "shell.nav.plan": ["Plan", { slots: {}, fixedBy: "SPEC §4 (2026-09-20)" }],
  "shell.nav.settings": ["Settings", { slots: {}, fixedBy: "REQ-040 c1" }],
  /** SPEC §4 (2026-09-20, #908) — the side panel that "collapses to an icon
   *  rail", and below the large breakpoint is a drawer. The checkbox that
   *  holds that choice is the one control keyboard and screen readers
   *  reach, so it carries the panel's name; the two icon-only labels that
   *  drive it carry the state each one moves to, as their tooltips.
   *  Drafted in the registry's voice (issue #911); the owner may correct. */
  "shell.panel.label": ["Side panel", { slots: {}, fixedBy: "issue 911" }],
  "shell.panel.collapse": ["Collapse the side panel", { slots: {}, fixedBy: "issue 911" }],
  "shell.panel.open": ["Open the side panel", { slots: {}, fixedBy: "issue 911" }],
  /** The name of the frame every `/app` screen is drawn inside — the top
   *  bar, the content well and the side panel together — so the one control
   *  that opens and collapses that panel stands inside a landmark that says
   *  what it belongs to rather than in no region at all (axe's `region`, on
   *  all thirteen `/app` screens; owner ruling 2026-09-23, #328).
   *
   *  A reader moving by landmarks hears it once, on arrival, and it is the
   *  word the panel's own heading already uses for the same thing.
   *  Drafted in the registry's voice (#328); the owner may correct. */
  "shell.frame.label": ["Workspace", { slots: {}, fixedBy: "issue 328" }],
  /** SPEC §4 (2026-09-20) — the side panel's card for the page in review:
   *  its title, and when it publishes if the customer does nothing. It asks
   *  for nothing (owner 2026-10-08, issue 1337): the page publishes on its
   *  own, and the card says so and until when it can be edited or stopped.
   *  It is headed as the next page of the daily autopilot, not as something
   *  waiting to be read (owner 2026-10-09, issue 1362). The
   *  time is the shell's own formatted date-time in the customer's zone
   *  (`format.ts`), never a composed "tomorrow": the shell states the day
   *  it knows rather than a word it would have to work out. */
  "shell.waiting.head": ["Next page", { slots: {}, fixedBy: "issue 1362" }],
  "shell.waiting.goes-live": [
    "Goes live on its own {when}. Edit or stop it until then.",
    { slots: { when: "date" }, fixedBy: "issue 1337" },
  ],
  /** SPEC §4 (2026-09-20) — the side panel's two shortcuts. Each is drawn
   *  only where it can act (SPEC §4, 2026-09-20: "a control that cannot act
   *  is not drawn"), so the blog link is absent until a blog is live. */
  "shell.shortcut.blog": ["Visit your blog", { slots: {}, fixedBy: "issue 911" }],
  "shell.shortcut.help": ["Help", { slots: {}, fixedBy: "issue 911" }],
  "shell.publishing.mode.autopilot": ["Autopilot", { slots: {}, fixedBy: "REQ-040 c3" }],
  // What the mode is doing, under the mode's own word (UI-SPEC S12's
  // autopilot card: the eyebrow, then "Publishing daily", then the next
  // line). The autopilot arm is unbracketed in the set and so approved
  // (11a); the set draws no copilot sidebar, so its sentence is the
  // owner's (#460).
  "shell.publishing.state.autopilot": ["Publishing daily", { slots: {}, fixedBy: "S12" }],
  // UI-SPEC S13: before the first weekly pass, what the mode is doing is
  // waiting on the deep pass. The *next* line beside it is still
  // `nextPublishStatement`'s — the set draws "deep pass running" there,
  // which would be a fifth `next-publish.*` cause, and REQ-040 c4's union
  // is closed ("This module adds none"). So this key is the state sentence
  // only, and the owner decides whether c4 gains a cause.
  "shell.publishing.state.week-zero": [
    "First page after the deep scan",
    { slots: {}, fixedBy: "S13" },
  ],
  /** Issue #782: Overview and Calendar while the onboarding pass and the
   *  first draft run in the background, the founder already in the app.
   *  Drafted in the registry's voice; the owner may correct it. */
  "shell.onboarding.first-page": [
    // **Shortened by issue 912**, to the sentence that issue drafts. The
    // half that went — "This screen updates itself when it's ready — you
    // can leave it open or come back later" — is now said better and in
    // more detail by the card it heads: the five named steps say how far
    // along the pass is, and `overview.first-day.mail` says what happens
    // when it ends. One heading, then the answer, rather than a heading
    // that answers.
    "Your first page is being written.",
    { slots: {}, fixedBy: "issue 782 · issue 912" },
  ],
  /** SPEC §4 (2026-09-20), issue 912 — the first day after setup, and the
   *  three states a named pass step can be in. Drafted under the owner's
   *  2026-09-16 ruling (#759); the first three are issue 912's own proposed
   *  wording, taken byte for byte. */
  "shell.pass-step.done": ["done", { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 912" }],
  "shell.pass-step.now": ["now", { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 912" }],
  "shell.pass-step.next": ["next", { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 912" }],
  /** Issue 1196 — the side panel's one status line for a pass: when its
   *  step began, and how it ended. Drafted in the registry's voice; the
   *  owner may correct them. */
  "shell.pass.remeasure-head": ["Scanning your market again", { slots: {}, fixedBy: "issue 1196" }],
  "shell.pass.since": ["This step started at {time}.", { slots: { time: "text" }, fixedBy: "issue 1196" }],
  "shell.pass.ended.done": [
    "Scan finished at {time}. Your screens show what it found.",
    { slots: { time: "text" }, fixedBy: "issue 1196" },
  ],
  "shell.pass.ended.failed": [
    "Scan failed at {time}, on our side. Nothing is needed from you; the next scan fills it in.",
    { slots: { time: "text" }, fixedBy: "issue 1196" },
  ],
  "shell.pass.ended.site-unreadable": [
    "Scan failed at {time}: we couldn’t read your site. Check that it’s online, then scan again from Settings.",
    { slots: { time: "text" }, fixedBy: "issue 1196" },
  ],
  "shell.pass.ended.time-ceiling": [
    "Scan stopped at {time}: it ran out of time. What it measured is shown; the next scan fills in the rest.",
    { slots: { time: "text" }, fixedBy: "issue 1196" },
  ],
  "shell.pass.ended.spend-ceiling": [
    "Scan stopped at {time}: it reached its spending limit. What it measured is shown; the next scan fills in the rest.",
    { slots: { time: "text" }, fixedBy: "issue 1196" },
  ],
  // Both approved as written by the screen set (ruling 11a): S12's domain
  // block reads "Week 6 · re-measured Mon 1 Sep" and S13's — the week the
  // first Monday has not come — reads "not measured yet · first due Mon 8
  // Sep". Each slot the key already declared is spent by the sentence the
  // owner drew, so neither shape moved to fit the words.
  "shell.domain.measured-weeks": [
    "Week {weeks} · scanned {on}",
    { slots: { weeks: "text", on: "date" }, fixedBy: "REQ-040 c6 · S12" },
  ],
  "shell.domain.not-measured": [
    "not scanned yet · first due {due}",
    { slots: { due: "date" }, fixedBy: "REQ-040 c7 · S13" },
  ],
}) satisfies CopyPartition;
