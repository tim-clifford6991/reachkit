// BUILD §2.2 — daisyUI `badge`.
// src/ui/components/Badge.tsx
//
// `components.md` §1, verbatim: "`badge` (+`primary`/`success`/`warning`/
// `error`/`ghost`), keyed by `Tone`. **Requires a text child** — a tone
// alone may never carry meaning" | "default" (one state).
//
// `children` is required — there is no tone-only call shape, so a tone can
// never stand in for a caption (REQ-004 c4 / BP-018's words-not-colour
// rule). The five listed daisyUI modifier classes pair one-to-one with
// `Tone`'s five members (an internal mapping, rule 1.1 — reversal cost: one
// line in this table): `accent`→`primary`, `ok`→`success`, `warn`→
// `warning`, `bad`→`error`, `neutral`→`ghost`.
import type React from "react";
import type { Tone } from "../types";

const TONE_CLASS: Record<Tone, string> = {
  accent: "badge-primary",
  ok: "badge-success",
  warn: "badge-warning",
  bad: "badge-error",
  neutral: "badge-ghost",
};

export function Badge(p: {
  tone: Tone;
  /** Required — a tone alone may never carry meaning. */
  children: React.ReactNode;
  /** Optional, added by issue #352 (rule 1.1: internal, additive,
   *  backward-compatible — every existing caller keeps omitting it and
   *  renders exactly as before). daisyUI's badge is one line at a fixed
   *  height, which is right for a word and wrong for the approved set's
   *  **source chip** — "names a source and date" — whose line is longer
   *  than a half-width card at the compact band. A chip that cannot wrap
   *  is a chip whose text is cut off, which is check 3's own finding; a
   *  chip that wraps says the same thing on two lines. */
  wrap?: boolean;
}): React.JSX.Element {
  const classes = ["badge", TONE_CLASS[p.tone]];
  if (p.wrap === true) classes.push("h-auto", "whitespace-normal", "py-1", "text-left");
  return <span className={classes.join(" ")}>{p.children}</span>;
}
