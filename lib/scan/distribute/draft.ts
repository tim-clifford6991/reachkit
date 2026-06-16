/**
 * Execution layer (M5) — the draft engine.
 *
 * Generates a PLATFORM-NATIVE draft for one opportunity (a demand thread, a
 * launch post, a community intro). Native rewrites are mandatory — duplicate
 * cross-posts are the #1 spam signal — and the tone is value-first, never a
 * pitch, never soliciting upvotes. Prompt + parser are pure; the LLM call is
 * fixtures-aware. We draft on demand (only what the user wants to post), not for
 * every item up front.
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import type { SharePlatform, CoachPlatform } from "./intent";

const MODEL = "claude-sonnet-4-6" as const;

export type DraftPlatform = SharePlatform | CoachPlatform;

export interface DraftContext {
  platform: DraftPlatform;
  productName: string;
  productDescription?: string;
  /** The specific opportunity: a thread/subreddit, a launch angle, etc. */
  angle: string;
  /** A link to share, if any. */
  url?: string;
}

const STYLE: Record<DraftPlatform, string> = {
  x: "A punchy X/Twitter post under 280 chars. Hook first line. Put any link on its own last line. 0-2 hashtags max.",
  threads: "A conversational Threads post, 1-2 short paragraphs. No hashtag spam.",
  reddit: "A genuine Reddit self-post: a TITLE and a BODY. Lead with the problem/story; mention the product only as a soft, honest aside near the end. Sound like a real person, not marketing.",
  linkedin: "A professional LinkedIn post: a story-led hook, short paragraphs, a takeaway. Put the link in a 'link in comments' note rather than the body.",
  telegram: "A short, friendly Telegram message.",
  whatsapp: "A short, personal WhatsApp message.",
  facebook: "A short, friendly Facebook post.",
  email: "A short outreach email: a SUBJECT and a BODY. Personal, specific, no fluff.",
  hackernews: "A 'Show HN' post: a TITLE (format 'Show HN: <thing> – <one-line>') and a BODY explaining what it is and why you built it. Humble, technical, no marketing speak.",
  producthunt: "A Product Hunt launch comment: what it is, the problem it solves, and a genuine ask for feedback. No upvote requests.",
  discord: "A short, value-first community message for a relevant channel.",
  indiehackers: "A genuine Indie Hackers post: share the journey/learning, product as context not pitch.",
};

const NEEDS_TITLE = new Set<DraftPlatform>(["reddit", "email", "hackernews"]);

export function buildDraftPrompt(ctx: DraftContext): string {
  const product = ctx.productDescription
    ? `${ctx.productName} — ${ctx.productDescription}`
    : ctx.productName;
  const titleLine = NEEDS_TITLE.has(ctx.platform)
    ? `{ "title": "...", "text": "..." }`
    : `{ "text": "..." }`;
  return `Write ONE post to distribute this product. It must be PLATFORM-NATIVE and
value-first — genuinely useful, not a pitch, and NEVER asking for upvotes.

PRODUCT: ${product}
OPPORTUNITY: ${ctx.angle}
${ctx.url ? `LINK: ${ctx.url}` : ""}

PLATFORM STYLE: ${STYLE[ctx.platform]}

Hard rules:
- Sound like a real person on that platform. No generic marketing voice.
- Lead with value/the problem; the product is a soft, honest mention.
- Never solicit upvotes, likes, or shares.
- This is a DRAFT the founder will edit before posting.

Return ONLY this JSON (no fences): ${titleLine}`;
}

export interface Draft {
  text: string;
  title?: string;
}

/** Pure: parse the model's draft JSON defensively. */
export function parseDraft(raw: string): Draft {
  try {
    const o = JSON.parse(extractJson(raw)) as { text?: unknown; title?: unknown };
    const text = String(o.text ?? "").trim();
    const title = o.title ? String(o.title).trim() : undefined;
    return title ? { text, title } : { text };
  } catch {
    // Fall back to the raw text so the user still gets something editable.
    return { text: raw.trim() };
  }
}

/** Generate a platform-native draft. Fixtures-mode returns a labelled stub. */
export async function generateDraft(ctx: DraftContext): Promise<Draft> {
  if (fixturesEnabled()) {
    return { text: `[draft:${ctx.platform}] ${ctx.angle}` };
  }
  const { text } = await callModel({
    model: MODEL,
    system: "You write platform-native, value-first distribution drafts. Return only JSON.",
    prompt: buildDraftPrompt(ctx),
    scanId: null,
    stage: "synth",
  });
  return parseDraft(text);
}
