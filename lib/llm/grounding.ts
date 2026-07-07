/**
 * Leaf module (no intra-llm imports) defining the market-data grounding that the
 * action generator must anchor to. Kept separate from actions.ts / prompts.ts so
 * BOTH can import `ActionGrounding` without creating a cycle (actions.ts imports
 * buildActionsPrompt/ACTIONS_SYSTEM from prompts.ts).
 */

import type { EngagedCommunity, CreatorReach } from "@/lib/scan/report";

/** The already-collected market data the action generator must ground in.
 *  Competitors carry real community-mention counts; communities are ranked by
 *  engagement; creators are named YouTubers who covered a competitor. */
export interface ActionGrounding {
  competitors: { name: string; positioning: string | null; themMentions: number; youMentions: number }[];
  communities: EngagedCommunity[];
  creators: CreatorReach[];
}

export const EMPTY_GROUNDING: ActionGrounding = { competitors: [], communities: [], creators: [] };
