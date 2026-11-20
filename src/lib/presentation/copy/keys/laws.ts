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
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const LAWS_COPY = Object.freeze({
  "stopped.work.line": ["We stopped our own work today, so no page was written. Your market didn’t change.", { law: "stopped-work", slots: {} }],
  "stopped.work.needs-nothing": [
    "Nothing is needed from you. We start again on our own.",
    { law: "stopped-work", slots: {} },
  ],
  "stopped.work.resumes-on": [
    "We expect to start again on {date}.",
    { law: "stopped-work", slots: { date: "date" } },
  ],
  "stopped.work.no-time-promised": [
    "We can’t say yet when we’ll resume.",
    { law: "stopped-work", slots: {} },
  ],
  "stopped.work.partial-pass": [
    "This page was written from a check that didn’t finish.",
    { law: "stopped-work", slots: {} },
  ],
  "next-publish.stopped": ["We stopped our own work, so no page is scheduled.", { law: "next-publish", slots: {} }],
  "next-publish.scheduled": [
    "Next page goes live {at}",
    { law: "next-publish", slots: { at: "date" } },
  ],
  // The hosted address is not connected yet, so no page can go live (the
  // OverviewDNS board's sidebar line). Drafted; the owner corrects it.
  "next-publish.address-waiting": ["Waiting for your website", { law: "next-publish", slots: {} }],
  "next-publish.paused": ["Publishing is paused.", { law: "next-publish", slots: {} }],
  // The site has an invoice outstanding, so publishing waits on payment; opens with Billing's own words. Drafted; the owner corrects it.
  "next-publish.unpaid": [
    "Your last payment didn’t go through, so no page goes live. Pay in Settings › Billing and pages resume.",
    { law: "next-publish", slots: {} },
  ],
  // The paid term has ended, so publishing waits; "access has ended" is the hosting-end mail's word, and no fix is promised.
  "next-publish.ended": ["Your access has ended, so no page goes live.", { law: "next-publish", slots: {} }],
  // What happens next when nothing holds publishing back. Drafted; the owner corrects it.
  "next-publish.page": [
    "Next page goes live {at}: {title}",
    { law: "next-publish", slots: { at: "date", title: "text" } },
  ],
  // The next page has no moment yet, so the line names its day and how far it got. Drafted; the owner corrects it.
  "next-publish.writing": [
    "Next page, {on}: {title}. Being written.",
    { law: "next-publish", slots: { on: "date", title: "text" } },
  ],
  "next-publish.ready": [
    "Next page, {on}: {title}. Ready.",
    { law: "next-publish", slots: { on: "date", title: "text" } },
  ],
  "next-publish.topic": [
    "Next page planned for {on}: {topic}",
    { law: "next-publish", slots: { on: "date", topic: "text" } },
  ],
  "next-publish.monday-check": [
    "The Monday check on {on} plans the next pages.",
    { law: "next-publish", slots: { on: "date" } },
  ],
  // §4.6's draft view renders a written page's body only through
  // `renderGenerated`, which resolves this key for the label that must ride
  // with it (REQ-093 c2).
  // 2026-09-09, issue #377: filled from UI-SPEC S16, which draws the label
  // on the draft's own card head as `generated by ReachKit · labelled` —
  // unbracketed, so approved copy under ruling 11a. The `{pageTitle}` slot
  // stays declared and stays supplied: the set puts the label on the card
  // rather than inside the sentence, so the `{pageTitle}` slot this key
  // declared is dropped: a declared slot the sentence never
  // spends is a placeholder nothing substitutes, which
  // `tests/presentation/copy/registry.test.ts` refuses. Callers may still
  // pass the title — `copy()` ignores a var no slot names — and the label
  // rides beside the page it labels, which is what REQ-093 c2 asks.
  "generated.page.written": [
    "generated by ReachKit · labelled",
    { slots: {} },
  ],
  // A written page the customer has saved an edit to credits them.
  "generated.page.edited": [
    "Written by ReachKit · edited by you",
    { slots: {} },
  ],
  // The free report's free-page card (`BUILD.md` §4.1 module 5) renders a
  // proposed page's title, which is model text and therefore reaches the
  // screen only through `renderGenerated`, which resolves this key for the
  // label that must ride with it. The owner's sentence, written on
  // 2026-09-10 (#460).
  "generated.page.proposed": [
    "proposed by ReachKit · not yet written · {pageTitle}",
    { slots: { pageTitle: "text" } },
  ],
  "unmeasured.undeterminable": ["We couldn’t check {what} this time.", { law: "unmeasured", slots: { what: "text" } }],
  "unmeasured.not-attempted": ["We didn’t check {what}, because the check stopped early.", { law: "unmeasured", slots: { what: "text" } }],
  "unmeasured.not-yet": ["We couldn’t check this yet.", { law: "unmeasured", slots: {} }],
  "unmeasured.dash": ["—", { law: "unmeasured", slots: {} }],
  // The label the screen set draws over the three nav rows, in the eyebrow
  // role (S12, UI-SPEC §2's sidebar row). Approved as written (11a); the
  // uppercase is the role's, not the string's.
  "shell.workspace": ["Workspace", { slots: {} }],
  "shell.nav.overview": ["Overview", { slots: {} }],
  // SPEC §4 (2026-09-20, #908): "Menu: **Overview · Plan · Settings**" —
  // *Plan* is the calendar's on-screen name, so the destination keeps its
  // address and loses its old word. The key was `shell.nav.calendar`; a
  // renamed key rather than a re-worded one, so nothing can go on speaking
  // "Calendar" from a name that no longer means it.
  "shell.nav.plan": ["This Week", { slots: {} }],
  "shell.nav.settings": ["Settings", { slots: {} }],
  /** SPEC §4 (2026-09-20, #908) — the side panel that "collapses to an icon
   *  rail", and below the large breakpoint is a drawer. The checkbox that
   *  holds that choice is the one control keyboard and screen readers
   *  reach, so it carries the panel's name; the two icon-only labels that
   *  drive it carry the state each one moves to, as their tooltips.
   *  Drafted in the registry's voice (issue #911); the owner may correct. */
  "shell.panel.label": ["Side panel", { slots: {} }],
  "shell.panel.collapse": ["Collapse the side panel", { slots: {} }],
  "shell.panel.open": ["Open the side panel", { slots: {} }],
  /** The name of the frame every `/app` screen is drawn inside — the top
   *  bar, the content well and the side panel together — so the one control
   *  that opens and collapses that panel stands inside a landmark that says
   *  what it belongs to rather than in no region at all (axe's `region`, on
   *  all thirteen `/app` screens; owner ruling 2026-09-23, #328).
   *
   *  A reader moving by landmarks hears it once, on arrival, and it is the
   *  word the panel's own heading already uses for the same thing.
   *  Drafted in the registry's voice (#328); the owner may correct. */
  "shell.frame.label": ["Workspace", { slots: {} }],
  /** SPEC §4 (2026-09-20) — the side panel's card for the page in review:
   *  its title, and when it publishes if the customer does nothing. It asks
   *  for nothing (owner 2026-10-08, issue 1337): the page publishes on its
   *  own, and the card says so and until when it can be edited or stopped.
   *  It is headed as the next page of the daily autopilot, not as something
   *  waiting to be read (owner 2026-10-09, issue 1362). The
   *  time is the shell's own formatted date-time in the customer's zone
   *  (`format.ts`), never a composed "tomorrow": the shell states the day
   *  it knows rather than a word it would have to work out. */
  "shell.waiting.head": ["Next Page", { slots: {} }],
  "shell.waiting.goes-live": [
    "Goes live on its own {when}. Edit or stop it until then.",
    { slots: { when: "date" } },
  ],
  /** SPEC §4 (2026-09-20) — the side panel's two shortcuts. Each is drawn
   *  only where it can act (SPEC §4, 2026-09-20: "a control that cannot act
   *  is not drawn"), so the blog link is absent until a blog is live. */
  "shell.shortcut.blog": ["Open Your Pages", { slots: {} }],
  "shell.shortcut.help": ["Help", { slots: {} }],
  "shell.publishing.mode.autopilot": ["Autopilot", { slots: {} }],
  // What the mode is doing, under the mode's own word (UI-SPEC S12's
  // autopilot card: the eyebrow, then "Publishing on", then the next
  // line). The autopilot arm is unbracketed in the set and so approved
  // (11a); the set draws no copilot sidebar, so its sentence is the
  // owner's (#460).
  "shell.publishing.state.autopilot": ["Publishing on", { slots: {} }],
  // UI-SPEC S13: before the first weekly pass, what the mode is doing is
  // waiting on the deep pass. The *next* line beside it is still
  // `nextPublishStatement`'s — the set draws "deep pass running" there,
  // which would be a fifth `next-publish.*` cause, and REQ-040 c4's union
  // is closed ("This module adds none"). So this key is the state sentence
  // only, and the owner decides whether c4 gains a cause.
  "shell.publishing.state.week-zero": [
    "First page after your first check",
    { slots: {} },
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
    { slots: {} },
  ],
  /** SPEC §4 (2026-09-20), issue 912 — the first day after setup, and the
   *  three states a named pass step can be in. Drafted under the owner's
   *  2026-09-16 ruling (#759); the first three are issue 912's own proposed
   *  wording, taken byte for byte. */
  "shell.pass-step.done": ["done", { slots: {} }],
  "shell.pass-step.now": ["now", { slots: {} }],
  "shell.pass-step.next": ["next", { slots: {} }],
  /** Issue 1196 — the side panel's one status line for a pass: when its
   *  step began, and how it ended. Drafted in the registry's voice; the
   *  owner may correct them. */
  "shell.pass.remeasure-head": ["Checking your market again", { slots: {} }],
  "shell.pass.ended.done": [
    "Check finished at {time}. Your screens show what it found.",
    { slots: { time: "text" } },
  ],
  "shell.pass.ended.degraded": [
    "Check finished at {time}. Some parts couldn’t be read this time; the next check fills them in.",
    { slots: { time: "text" } },
  ],
  "shell.pass.ended.failed": [
    "The check failed at {time}, on our side. The next check, on {due}, fills in the rest.",
    { slots: { time: "text", due: "date" } },
  ],
  "shell.pass.ended.site-unreadable": [
    "We couldn’t read your site at {time}. Check that it’s online, then check again in Settings.",
    { slots: { time: "text" } },
  ],
  "shell.pass.ended.time-ceiling": [
    "The check ran out of time at {time}. The next check, on {due}, fills in the rest.",
    { slots: { time: "text", due: "date" } },
  ],
  "shell.pass.ended.spend-ceiling": [
    "The check stopped early at {time}, on our side. The next check fills in the rest.",
    { slots: { time: "text" } },
  ],
  // Both approved as written by the screen set (ruling 11a): S12's domain
  // block reads "Week 6 · re-measured Mon 1 Sep" and S13's — the week the
  // first Monday has not come — reads "not measured yet · first due Mon 8
  // Sep". Each slot the key already declared is spent by the sentence the
  // owner drew, so neither shape moved to fit the words.
  "shell.domain.measured-weeks": [
    "Week {weeks} · checked {on}",
    { slots: { weeks: "text", on: "date" } },
  ],
  "shell.domain.not-measured": [
    "not checked yet · first on {due}",
    { slots: { due: "date" } },
  ],
  // Before the first weekly pass, the onboarding pass is what the line names: running, or the day it checked.
  "shell.domain.checking": ["checking now", { slots: {} }],
  "shell.domain.checked": [
    "checked {on} · next on {due}",
    { slots: { on: "date", due: "date" } },
  ],
}) satisfies CopyPartition;
