// SPEC §4, §6.2 (issue 867) — the words the two screens put on a target's
// engines, in one place.
//
// The day panel and the draft screen state the same four engine standings
// and the same three engine names. Both maps are **total** over their
// handle types, so a fourth engine or a fifth standing is a compile error
// here rather than an unlabelled value on a screen.
//
// The engine names are the report screen's own keys: §6.2's three columns
// are already named there, and a second spelling of "Google AI Overview"
// would be the second place the product speaks (ADR-001).
import type { CopyKey } from "@/lib/presentation/copy";
import type { AnswerEngine, EngineStanding } from "@/lib/opportunities/types";

export const ENGINE_LABEL: Readonly<Record<AnswerEngine, CopyKey>> = Object.freeze({
  ai_overview: "ai-answers.engine.ai-overview",
  ai_mode: "ai-answers.engine.ai-mode",
  chatgpt: "ai-answers.engine.chatgpt",
});

/** The four standings. `unmeasured` is the report's own "not measured" —
 *  an engine nobody asked is a fact about the measurement, never a miss. */
export const ENGINE_STANDING: Readonly<Record<EngineStanding, CopyKey>> = Object.freeze({
  names_you: "calendar.why.engine.names-you",
  names_others: "calendar.why.engine.names-others",
  no_answer: "calendar.why.engine.no-answer",
  unmeasured: "ai-answers.engine.not-measured",
});

/** The same grouping every count on these screens is formatted with
 *  (`_overview/present.ts` fixes the locale once). Re-exported here so the
 *  calendar and the draft screen format a volume the one way. */
export { formatCount } from "../_overview/present";
