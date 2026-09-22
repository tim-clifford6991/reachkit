// SPEC §6 (2026-09-22, #1004) — the LLM Mentions leaf's one public face.
//
// Three things leave this module and nothing else does: what a week is
// (`types.ts`), the Monday read that buys one (`pass.ts`), and the window
// read the AI answers tab's two cards are drawn from (`store.ts`). The
// vendor call itself is not re-exported — it is the closed DataForSEO
// barrel's, and this leaf is its only caller.
export type { MentionReadStatus, MentionWeek, StoredMention } from "./types";
export type { MentionsPassOutcome } from "./pass";
export { readWeeklyMentions } from "./pass";
export { readMentionWeeks } from "./store";
