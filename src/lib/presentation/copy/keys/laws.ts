// src/lib/presentation/copy/keys/laws.ts — BP-020 decision 5, WO-041
//
// The sentences the cross-cutting laws are made of, which no single surface
// owns: the five stopped-work lines, the five next-publish lines and the
// two generated-page lines (WO-041 step 3). Empty value, owner-owed — no
// string is written here (constitution §1). BP-019 decision 6 adds a
// fourth law's three keys later (WO-249); this file seeds only these
// twelve.
//
// 2026-09-04: the owner ruled on three of the twelve (WO-041 `## Log`,
// this date's ruling) — `stopped.work.line`, `stopped.work.needs-nothing`
// and `next-publish.scheduled` — filled verbatim, byte for byte, and no
// longer owner-owed. The remaining nine were not part of this ruling and
// stay owner-owed, empty.
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
// owner's sentences; nothing is written here, and
// `tests/presentation/sweeps/` reports which lines are still the marker.
import type { CopyPartition } from "../registry.ts";

export const LAWS_COPY = Object.freeze({
  "stopped.work.line": ["ReachKit stopped its own work today, so no page was written. Nothing about your market changed.", { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c1" }],
  "stopped.work.needs-nothing": [
    "Nothing is needed from you — ReachKit picks up again on its own.",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c2" },
  ],
  "stopped.work.resumes-on": [
    "TODO(copy)",
    { law: "stopped-work", slots: { date: "date" }, fixedBy: "REQ-092 c4" },
  ],
  "stopped.work.no-time-promised": [
    "TODO(copy)",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c4" },
  ],
  "stopped.work.partial-pass": [
    "TODO(copy)",
    { law: "stopped-work", slots: {}, fixedBy: "REQ-092 c6" },
  ],
  "next-publish.stopped": ["TODO(copy)", { law: "next-publish", slots: {}, fixedBy: "REQ-092 c7" }],
  "next-publish.scheduled": [
    "Next page goes live {at}",
    { law: "next-publish", slots: { at: "date" }, fixedBy: "REQ-040 c4" },
  ],
  "next-publish.paused": ["TODO(copy)", { law: "next-publish", slots: {}, fixedBy: "REQ-040 c4" }],
  "next-publish.nothing-approved": [
    "TODO(copy)",
    { law: "next-publish", slots: {}, fixedBy: "REQ-040 c4" },
  ],
  "next-publish.none-planned": [
    "TODO(copy)",
    { law: "next-publish", slots: {}, fixedBy: "REQ-040 c4" },
  ],
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
  "generated.page.written": [
    "TODO(copy)",
    { slots: { pageTitle: "text" }, fixedBy: "REQ-093 c2" },
  ],
  // 2026-09-05, issue #13: value moved from "" to `TODO(copy)` per
  // `CLAUDE.md`'s standing rule. The free report's free-page card
  // (`BUILD.md` §4.1 module 5) renders a proposed page's title, which is
  // model text and therefore reaches the screen only through
  // `renderGenerated` — and `renderGenerated` resolves this key for the
  // label that must ride with it. Left empty, `copy()` throws and the
  // whole report screen goes down; `TODO(copy)` renders as itself, so the
  // label is visibly present and visibly unwritten. Still the owner's
  // sentence; no string is written here. `generated.page.written` is
  // untouched — no surface renders it yet, and
  // `tests/presentation/generated/text.test.ts` asserts the owner-owed
  // throw against it.
  "generated.page.proposed": [
    "TODO(copy)",
    { slots: { pageTitle: "text" }, fixedBy: "REQ-093 c2" },
  ],
  "unmeasured.undeterminable": ["{what} couldn’t be measured — nothing came back that could be read.", { law: "unmeasured", slots: { what: "text" }, fixedBy: "REQ-004 c6" }],
  "unmeasured.not-attempted": ["{what} wasn’t measured — the scan stopped early, before it got there.", { law: "unmeasured", slots: { what: "text" }, fixedBy: "REQ-004 c9" }],
  "unmeasured.dash": ["—", { law: "unmeasured", slots: {}, fixedBy: "REQ-004 c2" }],
  // The label the screen set draws over the three nav rows, in the eyebrow
  // role (S12, UI-SPEC §2's sidebar row). Approved as written (11a); the
  // uppercase is the role's, not the string's.
  "shell.workspace": ["Workspace", { slots: {}, fixedBy: "UI-SPEC S12" }],
  "shell.nav.overview": ["Overview", { slots: {}, fixedBy: "REQ-040 c1" }],
  "shell.nav.calendar": ["Calendar", { slots: {}, fixedBy: "REQ-040 c1" }],
  "shell.nav.settings": ["Settings", { slots: {}, fixedBy: "REQ-040 c1" }],
  "shell.publishing.mode.autopilot": ["Autopilot", { slots: {}, fixedBy: "REQ-040 c3" }],
  "shell.publishing.mode.copilot": ["Copilot", { slots: {}, fixedBy: "REQ-040 c3" }],
  // What the mode is doing, under the mode's own word (UI-SPEC S12's
  // autopilot card: the eyebrow, then "Publishing daily", then the next
  // line). The autopilot arm is unbracketed in the set and so approved
  // (11a); the set draws no copilot sidebar, so its sentence is owed and
  // the card states the mode word alone until it is written.
  "shell.publishing.state.autopilot": ["Publishing daily", { slots: {}, fixedBy: "UI-SPEC S12" }],
  "shell.publishing.state.copilot": ["TODO(copy)", { slots: {}, fixedBy: "REQ-040 c3" }],
  // UI-SPEC S13: before the first weekly pass, what the mode is doing is
  // waiting on the deep pass. The *next* line beside it is still
  // `nextPublishStatement`'s — the set draws "deep pass running" there,
  // which would be a fifth `next-publish.*` cause, and REQ-040 c4's union
  // is closed ("This module adds none"). So this key is the state sentence
  // only, and the owner decides whether c4 gains a cause.
  "shell.publishing.state.week-zero": [
    "First page after the deep pass",
    { slots: {}, fixedBy: "UI-SPEC S13" },
  ],
  // Both approved as written by the screen set (ruling 11a): S12's domain
  // block reads "Week 6 · re-measured Mon 1 Sep" and S13's — the week the
  // first Monday has not come — reads "not measured yet · first due Mon 8
  // Sep". Each slot the key already declared is spent by the sentence the
  // owner drew, so neither shape moved to fit the words.
  "shell.domain.measured-weeks": [
    "Week {weeks} · re-measured {on}",
    { slots: { weeks: "text", on: "date" }, fixedBy: "REQ-040 c6 · UI-SPEC S12" },
  ],
  "shell.domain.not-measured": [
    "not measured yet · first due {due}",
    { slots: { due: "date" }, fixedBy: "REQ-040 c7 · UI-SPEC S13" },
  ],
}) satisfies CopyPartition;
