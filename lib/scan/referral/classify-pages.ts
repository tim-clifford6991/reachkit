/**
 * Task 6b — page-level channel classification.
 *
 * Domain-level classification can't tell a CHANNEL a founder can join (directory,
 * podcast, community, guest-post blog) from a TOOL/PLATFORM/COMPETITOR they can't
 * (godaddy, moz, semrush, yandex). This fetches each top opportunity's homepage and
 * asks the LLM to classify the type AND whether it's actionable — so we keep only
 * real channels and attach a concrete action ("Submit your tool", "Pitch a guest post").
 *
 * One LLM call for the whole batch; homepage blurbs fetched in parallel.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fetchSiteBlurb } from "./llm-competitors";

export type OppChannelType =
  | "directory"
  | "marketplace"
  | "community"
  | "newsletter"
  | "podcast"
  | "blog"
  | "integration_partner"
  | "tool_or_platform"
  | "competitor"
  | "media"
  | "search_engine"
  | "other";

/** Types that are never a channel a founder can "get onto" → always dropped. */
const NON_CHANNEL: Set<OppChannelType> = new Set(["tool_or_platform", "competitor", "search_engine", "other"]);

export interface PageClassification {
  host: string;
  type: OppChannelType;
  actionable: boolean;
  action: string;
}

export interface ClassifyResult {
  classifications: PageClassification[];
  promptPreview: string;
  rawResponse: string;
  tokensIn: number;
  tokensOut: number;
}

export function buildClassifyPrompt(
  productName: string,
  category: string,
  sites: { host: string; blurb: string }[],
): string {
  const list = sites.map((s, i) => `${i + 1}. ${s.host} — ${s.blurb || "(no description fetched)"}`).join("\n");
  return `A solo founder is building "${productName}" (a ${category}). They want DISTRIBUTION CHANNELS — places they can realistically get LISTED, FEATURED, REVIEWED, post content, pitch a guest article, appear as a podcast guest, or join an integration directory.

For each site below, classify its TYPE and whether it is an actionable channel for this founder.

TYPES:
- directory: catalogs/lists tools — you can submit yours
- marketplace: review & listing platform (G2, Capterra, Product Hunt, SaaSHub) — list & collect reviews
- community: forum/community you can participate in (dev.to, Indie Hackers, a subreddit)
- newsletter: a newsletter/publication you can pitch
- podcast: a podcast you can pitch to guest on
- blog: an editorial/media blog that publishes guest posts or independent tool reviews — you can pitch
- integration_partner: a product whose integration directory you could join
- tool_or_platform: a SaaS tool / website builder / hosting / analytics / search engine — NOT a channel
- competitor: a direct competitor product in the founder's own category
- media: large general news/tech media (usually not realistically pitchable by a solo founder)
- other

SITES:
${list.slice(0, 6000)}

Return ONLY a JSON array (no fences):
[ { "host": "<host verbatim>", "type": "<type>", "actionable": true|false, "action": "<short imperative, e.g. 'Submit your tool' / 'Pitch a guest post' / 'Pitch to guest' — empty string if not actionable>" } ]

Rules:
- actionable=true ONLY when there's a concrete way IN (submit, list, post, pitch, review, integrate).
- A site that SELLS its own product (SEO tool, website builder, hosting, analytics) is tool_or_platform or competitor — NOT a channel — even if it has a blog. Mark actionable=false.
- Search engines (google, yandex, bing) are tool_or_platform, actionable=false.
- Be strict: when unsure whether a founder can realistically get on, mark actionable=false.`;
}

export function parseClassifications(raw: string, hosts: string[]): PageClassification[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  const known = new Set(hosts);
  const out: PageClassification[] = [];
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    const host = String(o["host"] ?? "").trim().toLowerCase();
    if (!known.has(host)) continue;
    const type = String(o["type"] ?? "other") as OppChannelType;
    // Hard rule: non-channel types are never actionable regardless of what the model said.
    const actionable = o["actionable"] === true && !NON_CHANNEL.has(type);
    out.push({ host, type, actionable, action: actionable ? String(o["action"] ?? "").trim() : "" });
  }
  return out;
}

/** Classify a batch of opportunity hosts. Never throws → empty on failure. */
export async function classifyOpportunityPages(args: {
  productName: string;
  category: string;
  hosts: string[];
}): Promise<ClassifyResult> {
  const empty: ClassifyResult = { classifications: [], promptPreview: "", rawResponse: "", tokensIn: 0, tokensOut: 0 };
  const hosts = args.hosts.slice(0, 25).map((h) => h.toLowerCase());
  if (hosts.length === 0) return empty;
  try {
    const blurbPairs = await Promise.all(hosts.map(async (h) => ({ host: h, blurb: await fetchSiteBlurb(h) })));
    const prompt = buildClassifyPrompt(args.productName, args.category, blurbPairs);
    const { text, usage } = await callModel({
      model: "claude-haiku-4-5-20251001",
      system:
        "You classify referring sites into distribution-channel types and decide whether a solo founder can realistically get onto each. A site that sells its own product is never a channel. Return only a JSON array.",
      prompt,
      scanId: null,
      stage: "extract",
    });
    return {
      classifications: parseClassifications(text, hosts),
      promptPreview: prompt.slice(0, 1000),
      rawResponse: text.slice(0, 1500),
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
    };
  } catch {
    return empty;
  }
}
