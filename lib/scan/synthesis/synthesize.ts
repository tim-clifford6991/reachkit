/**
 * Synthesis layer (the payoff) — Supply × Demand → action.
 *
 * Pulls the cached Supply (referral funnel + keyword gaps) and Demand (ICP +
 * search-demand themes + community pockets + competitor-review buyer insights),
 * then synthesizes two evidence-grounded, specific plans:
 *
 *   CONTENT PLAN      = demand themes/keywords × the format that WINS them × the
 *                       buyer's own language × the user's positioning
 *   DISTRIBUTION PLAN = where competitors are found (supply) ∩ where the audience
 *                       actually is (demand)
 *
 * Each item is concrete enough to act on today (target, format, brief, agent
 * prompt) and cites the evidence it came from. Cached via the Phase-1 global cache.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { gatherFullFunnel } from "@/lib/scan/referral/funnel";
import { gatherKeywordGap } from "@/lib/scan/referral/keyword-gap";
import { gatherDemand } from "@/lib/scan/demand/gather";
import { serverDb } from "@/lib/db/client";
import type { OnStageCallback } from "@/lib/scan/types";

export interface ContentPlanItem {
  topic: string;
  targetKeywords: string[];
  estMonthlyVolume: number;
  intent: string;
  format: string; // guide | comparison | listicle | template | tool | landing
  depthTarget: string; // e.g. "2,000–4,000 words"
  buyerAngle: string; // grounded in buyer pains / language
  competitorExemplars: Array<{ domain: string; url: string; position: number }>;
  brief: string;
  agentPrompt: string;
  priority: "high" | "medium" | "low";
  evidence: string;
}

export interface DistributionPlanItem {
  channel: string;
  action: string;
  target: string;
  targetUrl: string;
  why: string;
  effort: "low" | "medium" | "high";
  priority: "high" | "medium" | "low";
  evidence: string;
  /** Derived 0–1 axes for the Ease×Impact prioritization quadrant. */
  ease: number;
  impact: number;
}

export interface Synthesis {
  domain: string;
  category: string;
  summary: string;
  contentPlan: ContentPlanItem[];
  distributionPlan: DistributionPlanItem[];
}

const str = (v: unknown) => String(v ?? "").trim();
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []);
const prio = (v: unknown): "high" | "medium" | "low" => (["high", "medium", "low"].includes(String(v)) ? (v as "high") : "medium");

// ---------------------------------------------------------------------------
// Structured persistence (content_plan_item + distribution_plan_item tables)
// ---------------------------------------------------------------------------

/**
 * Upsert content plan rows into `content_plan_item`.
 * Best-effort — write errors are logged and swallowed so they never break the
 * gather. Called via `void ...catch(...)` inside the cachedJson body.
 */
async function persistContentPlan(subject: string, cohortKey: string, plan: ContentPlanItem[]): Promise<void> {
  if (plan.length === 0) return;
  const db = serverDb();
  const rows = plan.map((c) => ({
    subject_domain: subject,
    cohort_key: cohortKey,
    topic: c.topic,
    format: c.format,
    depth_target: c.depthTarget,
    priority: c.priority,
    est_monthly_volume: c.estMonthlyVolume,
    buyer_angle: c.buyerAngle,
    intent: c.intent,
    target_keywords: c.targetKeywords,
    brief: c.brief,
    agent_prompt: c.agentPrompt,
    evidence: c.evidence,
    fetched_at: new Date().toISOString(),
  }));
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    try {
      await db
        .from("content_plan_item")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "subject_domain,cohort_key,topic" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[content_plan_item] chunk ${i} persist failed: ${msg}`);
    }
  }
}

/**
 * Upsert distribution plan rows into `distribution_plan_item`.
 * Best-effort — write errors are logged and swallowed so they never break the
 * gather. Called via `void ...catch(...)` inside the cachedJson body.
 */
async function persistDistributionPlan(subject: string, cohortKey: string, plan: DistributionPlanItem[]): Promise<void> {
  if (plan.length === 0) return;
  const db = serverDb();
  const rows = plan.map((d) => ({
    subject_domain: subject,
    cohort_key: cohortKey,
    channel: d.channel,
    action: d.action,
    ease: d.ease,
    impact: d.impact,
    priority: d.priority,
    effort: d.effort,
    target: d.target,
    target_url: d.targetUrl,
    why: d.why,
    evidence: d.evidence,
    fetched_at: new Date().toISOString(),
  }));
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    try {
      await db
        .from("distribution_plan_item")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "subject_domain,cohort_key,channel,action" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[distribution_plan_item] chunk ${i} persist failed: ${msg}`);
    }
  }
}

export async function gatherSynthesis(rawSelf: string, opts: { competitorDomains?: string[]; onStage?: OnStageCallback } = {}): Promise<Synthesis> {
  const self = normalizeHost(rawSelf);
  const cohortKey = (opts.competitorDomains ?? []).map((d) => d.toLowerCase()).sort().join(",");
  // Cache the whole synthesis so a repeat is instant (otherwise the three gatherers
  // — incl. the funnel's uncached page-classification — re-run every call). Keyed by
  // the chosen cohort so different selections don't collide.
  return cachedJson(`synth:${self}:${cohortKey}`, 7 * DAY_MS, async () => {
    // Stage fired inside cachedJson body — cold computes only.
    opts.onStage?.({ key: "synthesis:plan", label: "Synthesizing your plan" });
    const co = opts.competitorDomains;
    const [funnel, kw, demand] = await Promise.all([
      gatherFullFunnel(self, { competitorDomains: co }),
      gatherKeywordGap(self, { competitorDomains: co }),
      gatherDemand(self, { competitorDomains: co }),
    ]);
    const category = demand.category || funnel.category;

    const [contentPlan, distributionPlan] = await Promise.all([
      synthContent({ self, category, demand, kw }),
      synthDistribution({ self, category, funnel, demand }),
    ]);
    const summary = await synthSummary({ self, category, demand, kw, funnel, contentPlan, distributionPlan });

    // Persist structured plan rows (best-effort, never blocks the return).
    void Promise.all([
      persistContentPlan(self, cohortKey, contentPlan),
      persistDistributionPlan(self, cohortKey, distributionPlan),
    ]).catch((err) => console.error("[synthesis] persist error:", err));

    return { domain: self, category, summary, contentPlan, distributionPlan };
  });
}

async function synthContent(i: {
  self: string;
  category: string;
  demand: Awaited<ReturnType<typeof gatherDemand>>;
  kw: Awaited<ReturnType<typeof gatherKeywordGap>>;
}): Promise<ContentPlanItem[]> {
  const themes = i.demand.searchDemand.themes.slice(0, 8).map((t) => `- ${t.theme} (${t.totalVolume}/mo, ${t.intent}): ${t.sampleKeywords.join(", ")}`).join("\n");
  const gaps = i.kw.gaps.slice(0, 15).map((g) => `- "${g.keyword}" (${g.volume}/mo, ${g.competitorsRanking} rivals); winning page e.g. ${g.competitors[0]?.domain} #${g.competitors[0]?.position} ${g.competitors[0]?.url ?? ""}`).join("\n");
  const pains = i.demand.buyerInsights.pains.slice(0, 6).join("; ");
  const language = i.demand.buyerInsights.buyerLanguage.slice(0, 6).join("; ");
  const key = `synth:content:${i.self}`;

  return cachedJson(key, 7 * DAY_MS, async () => {
    const prompt = `You are planning CONTENT for "${i.self}" — a ${i.category}. Target ICP: ${i.demand.icp.whoItsFor}.

DEMAND THEMES (what buyers search):
${themes || "(thin)"}

KEYWORD GAPS (rivals rank, ${i.self} doesn't — with the page that wins each):
${gaps || "(none)"}

BUYER PAINS: ${pains || "(unknown)"}
BUYER LANGUAGE (verbatim): ${language || "(unknown)"}

Produce 4–5 content assets that would most move discoverability. Lead with the highest demand × winnable keywords. Ground each in a buyer pain/the buyer's language, and infer the winning FORMAT + depth from the competitor pages that rank. Keep "brief" and "agentPrompt" CONCISE (a few sentences each) so the whole response stays valid JSON.

Return ONLY a JSON array:
[ {
  "topic": "<the content piece>",
  "targetKeywords": ["<2-5 keywords from the gaps/themes>"],
  "intent": "informational|commercial|transactional",
  "format": "guide|comparison|listicle|template|tool|landing",
  "depthTarget": "<e.g. 2,000–3,500 words>",
  "buyerAngle": "<the hook, grounded in a buyer pain/their language>",
  "competitorExemplars": [ { "domain": "<rival>", "url": "<their ranking page>", "position": <int> } ],
  "brief": "<3-4 concise bullets of what to cover>",
  "agentPrompt": "<one concise paragraph: a ready-to-run prompt for a writing agent>",
  "priority": "high|medium|low",
  "evidence": "<short: which theme/keyword/competitor>"
} ]`;
    try {
      const { text } = await callModel({ model: "claude-haiku-4-5-20251001", system: "You are a content strategist. Plans must be specific, demand-led, and grounded in the data. Keep prose concise so the JSON stays complete. Return only a JSON array.", prompt, scanId: null, stage: "synth", maxTokens: 8000 });
      const parsed = JSON.parse(extractJson(text));
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 6).map((x) => {
        const o = x as Record<string, unknown>;
        const exemplars = Array.isArray(o.competitorExemplars)
          ? (o.competitorExemplars as Record<string, unknown>[]).map((e) => ({ domain: str(e.domain), url: str(e.url), position: Number(e.position) || 0 })).filter((e) => e.domain)
          : [];
        const targetKeywords = arr(o.targetKeywords);
        const estMonthlyVolume = i.kw.gaps.filter((g) => targetKeywords.some((t) => t.toLowerCase() === g.keyword.toLowerCase())).reduce((s, g) => s + g.volume, 0);
        return {
          topic: str(o.topic), targetKeywords, estMonthlyVolume, intent: str(o.intent) || "informational",
          format: str(o.format) || "guide", depthTarget: str(o.depthTarget), buyerAngle: str(o.buyerAngle),
          competitorExemplars: exemplars.slice(0, 3), brief: str(o.brief), agentPrompt: str(o.agentPrompt),
          priority: prio(o.priority), evidence: str(o.evidence),
        };
      }).filter((c) => c.topic);
    } catch {
      return [];
    }
  });
}

async function synthDistribution(i: {
  self: string;
  category: string;
  funnel: Awaited<ReturnType<typeof gatherFullFunnel>>;
  demand: Awaited<ReturnType<typeof gatherDemand>>;
}): Promise<DistributionPlanItem[]> {
  const missing = i.funnel.channelsMissing.slice(0, 15).map((c) => `- ${c.host} (${c.type}): ${c.action} — feeds ${c.competitorsUsing} rivals`).join("\n");
  const discovery = Object.entries(i.funnel.discoveryChannels).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(", ");
  const wateringHoles = i.demand.community.pockets.slice(0, 8).map((p) => `- ${p.surface} (${p.count} buyer threads)`).join("\n");
  const personas = i.demand.buyerInsights.personas.slice(0, 5).join("; ");
  const key = `synth:dist:${i.self}`;

  return cachedJson(key, 7 * DAY_MS, async () => {
    const prompt = `You are planning DISTRIBUTION for "${i.self}" — a ${i.category}. Buyers: ${personas || i.demand.icp.whoItsFor}.

CHANNELS FEEDING COMPETITORS that ${i.self} is ABSENT from:
${missing || "(none)"}

HOW COMPETITORS ARE DISCOVERED (aggregate quality channels): ${discovery || "(thin)"}

WHERE BUYERS ACTUALLY ASK (community watering-holes):
${wateringHoles || "(none)"}

Produce 4–6 distribution actions. PRIORITIZE channels that are BOTH where competitors get found AND where the audience actually is. Be specific (exact place + action).

Return ONLY a JSON array:
[ {
  "channel": "directory|marketplace|community|media|podcast|newsletter|partner",
  "action": "<concrete action, e.g. 'Submit your tool', 'Pitch a guest post', 'Post a build-in-public thread'>",
  "target": "<the specific place>",
  "targetUrl": "<url if known, else ''>",
  "why": "<supply × demand: feeds N rivals AND/OR buyers are here>",
  "effort": "low|medium|high",
  "priority": "high|medium|low",
  "evidence": "<which channel/watering-hole this is grounded in>"
} ]`;
    try {
      const { text } = await callModel({ model: "claude-haiku-4-5-20251001", system: "You are a distribution strategist for solo founders. Prioritize channels at the intersection of competitor-proven and audience-present. Return only a JSON array.", prompt, scanId: null, stage: "synth", maxTokens: 3072 });
      const parsed = JSON.parse(extractJson(text));
      if (!Array.isArray(parsed)) return [];
      const EASE = { low: 0.8, medium: 0.5, high: 0.25 } as const;
      const IMPACT = { high: 0.85, medium: 0.55, low: 0.3 } as const;
      return parsed.slice(0, 6).map((x) => {
        const o = x as Record<string, unknown>;
        const effort = (["low", "medium", "high"].includes(String(o.effort)) ? o.effort : "medium") as "low" | "medium" | "high";
        const priority = prio(o.priority);
        return {
          channel: str(o.channel) || "other", action: str(o.action), target: str(o.target), targetUrl: str(o.targetUrl),
          why: str(o.why), effort, priority, evidence: str(o.evidence),
          ease: EASE[effort], impact: IMPACT[priority],
        };
      }).filter((c) => c.action && c.target);
    } catch {
      return [];
    }
  });
}

async function synthSummary(i: {
  self: string; category: string;
  demand: Awaited<ReturnType<typeof gatherDemand>>;
  kw: Awaited<ReturnType<typeof gatherKeywordGap>>;
  funnel: Awaited<ReturnType<typeof gatherFullFunnel>>;
  contentPlan: ContentPlanItem[]; distributionPlan: DistributionPlanItem[];
}): Promise<string> {
  const key = `synth:summary:${i.self}`;
  return cachedJson(key, 7 * DAY_MS, async () => {
    const prompt = `Write a 2–3 sentence strategic summary for "${i.self}" (${i.category}). Score ${i.funnel.subject.score}/100, ${i.funnel.subject.monthlyTraffic.toLocaleString()} monthly visits, ranks for ${i.kw.subject.rankedFor} keywords. Top content move: ${i.contentPlan[0]?.topic ?? "—"}. Top distribution move: ${i.distributionPlan[0]?.action ?? "—"} on ${i.distributionPlan[0]?.target ?? "—"}. Be direct about where they stand and the single highest-leverage path forward. Plain prose, no preamble.`;
    try {
      const { text } = await callModel({ model: "claude-haiku-4-5-20251001", system: "You are a blunt growth advisor. 2–3 sentences, plain prose.", prompt, scanId: null, stage: "synth" });
      return text.trim();
    } catch {
      return "";
    }
  });
}
