/**
 * AI visibility check (W3) — pure logic behind /tools/ai-visibility-check.
 *
 * Answers "can AI search engines see and understand this product?" from three
 * server-side fetches (homepage HTML, /llms.txt, /robots.txt) — no paid APIs.
 * Five pass/warn/fail checks + an overall verdict line; the page funnels into
 * the full 18-signal scan.
 */

import { parse } from "node-html-parser";
import { extractHtmlSignals } from "@/lib/scan/extract-html";

// ---------------------------------------------------------------------------
// Shared check shape (also used by the meta-preview checklist)
// ---------------------------------------------------------------------------

export type CheckState = "pass" | "warn" | "fail";

export interface ToolCheck {
  label: string;
  state: CheckState;
  detail: string;
}

// ---------------------------------------------------------------------------
// robots.txt — AI crawler access
// ---------------------------------------------------------------------------

/** The AI crawlers the tool reports on (product token in robots.txt). */
export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;

export type CrawlerAccess = "allowed" | "limited" | "blocked";

export interface RobotsVerdict {
  agent: string;
  access: CrawlerAccess;
}

interface RobotsGroup {
  agents: string[];
  disallows: string[];
}

/** Parse robots.txt into user-agent groups with their Disallow rules. */
function parseRobotsGroups(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  // True while consecutive User-agent lines are still extending one group.
  let collectingAgents = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents || current === null) {
        current = { agents: [], disallows: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
    } else {
      collectingAgents = false;
      if (current === null) continue;
      if (field === "disallow" && value.length > 0) current.disallows.push(value);
    }
  }
  return groups;
}

/**
 * Effective access for one crawler per the standard matching rule: the group
 * naming the agent (longest matching token) wins; otherwise the `*` group;
 * otherwise everything is allowed. `Disallow: /` → blocked; any other
 * Disallow → limited; none → allowed. (Allow-line overrides are out of scope
 * for a headline verdict — a site allow-listing paths still "limits" crawling.)
 */
export function evaluateRobotsAccess(robotsTxt: string, agent: string): CrawlerAccess {
  const groups = parseRobotsGroups(robotsTxt);
  const target = agent.toLowerCase();

  let best: { group: RobotsGroup; specificity: number } | null = null;
  for (const group of groups) {
    for (const ua of group.agents) {
      if (ua === "*" || ua.length === 0) continue;
      // "GPTBot" matches "gptbot", "gptbot/1.0", and a bare product-token
      // prefix (robots groups match by product-token prefix).
      const matches = ua === target || ua.startsWith(`${target}/`) || target.startsWith(ua.replace(/\/.*$/, ""));
      if (matches) {
        const specificity = ua.length;
        if (!best || specificity > best.specificity) best = { group, specificity };
      }
    }
  }
  if (!best) {
    const wildcard = groups.find((g) => g.agents.includes("*"));
    if (!wildcard) return "allowed";
    best = { group: wildcard, specificity: 0 };
  }

  const disallows = best.group.disallows;
  if (disallows.some((d) => d === "/")) return "blocked";
  if (disallows.length > 0) return "limited";
  return "allowed";
}

/** Access verdict for each AI crawler. `robotsTxt === null` means no robots.txt. */
export function aiCrawlerVerdicts(robotsTxt: string | null): RobotsVerdict[] {
  return AI_CRAWLERS.map((agent) => ({
    agent,
    access: robotsTxt === null ? "allowed" : evaluateRobotsAccess(robotsTxt, agent),
  }));
}

// ---------------------------------------------------------------------------
// Page signals AI engines read
// ---------------------------------------------------------------------------

export interface AiPageSignals {
  title: string;
  h1: string;
  metaDescription: string;
  ogDescription: string;
  jsonLdTypes: string[];
  hasJsonLd: boolean;
}

/** Extract the text-level signals the checks grade (title/h1/meta/og + JSON-LD). */
export function extractAiPageSignals(html: string): AiPageSignals {
  const root = parse(html);
  const signals = extractHtmlSignals(html);
  return {
    title: root.querySelector("title")?.text?.trim() ?? "",
    h1: root.querySelector("h1")?.text?.replace(/\s+/g, " ").trim() ?? "",
    metaDescription:
      root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "",
    ogDescription:
      root.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() ?? "",
    jsonLdTypes: signals.jsonLd.types,
    hasJsonLd: signals.jsonLd.present,
  };
}

// ---------------------------------------------------------------------------
// The five checks + verdict
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "that", "this", "from", "into", "you",
  "are", "our", "get", "all", "more", "best", "free", "how", "what", "why",
]);

/** Significant lowercase tokens (≥4 chars, not a stopword) from a string. */
function significantTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

/** Do two strings share at least one significant token? */
function sharesToken(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

export interface AiVisibilityInput {
  llmsTxt: { exists: boolean; text: string };
  /** null = site has no robots.txt (everything allowed). */
  robotsTxt: string | null;
  page: AiPageSignals;
}

export function buildAiVisibilityChecks(input: AiVisibilityInput): ToolCheck[] {
  const checks: ToolCheck[] = [];

  // 1. llms.txt — the guided summary AI answer engines look for first.
  const llms = input.llmsTxt;
  const llmsHasContent = llms.exists && llms.text.trim().length > 0;
  checks.push({
    label: "llms.txt",
    state: llmsHasContent ? "pass" : llms.exists ? "warn" : "fail",
    detail: llmsHasContent
      ? `present (${llms.text.trim().split(/\r?\n/).length} lines)`
      : llms.exists
        ? "present but empty"
        : "not found — AI engines get no guided summary of your product",
  });

  // 2. robots.txt rules for the four AI crawlers.
  const verdicts = aiCrawlerVerdicts(input.robotsTxt);
  const blocked = verdicts.filter((v) => v.access === "blocked").map((v) => v.agent);
  const limited = verdicts.filter((v) => v.access === "limited").map((v) => v.agent);
  checks.push({
    label: "AI crawler access",
    state: blocked.length > 0 ? "fail" : limited.length > 0 ? "warn" : "pass",
    detail:
      blocked.length > 0
        ? `robots.txt blocks ${blocked.join(", ")}`
        : limited.length > 0
          ? `robots.txt limits ${limited.join(", ")}`
          : input.robotsTxt === null
            ? "no robots.txt — all AI crawlers allowed"
            : "GPTBot, ClaudeBot, PerplexityBot & Google-Extended allowed",
  });

  // 3. Structured data — machine-readable facts about the product.
  const { jsonLdTypes, hasJsonLd } = input.page;
  checks.push({
    label: "Structured data (JSON-LD)",
    state: jsonLdTypes.length > 0 ? "pass" : hasJsonLd ? "warn" : "fail",
    detail:
      jsonLdTypes.length > 0
        ? jsonLdTypes.slice(0, 4).join(", ")
        : hasJsonLd
          ? "JSON-LD present but no @type readable"
          : "none found — AI engines must guess what you are",
  });

  // 4. Description tags — the snippet AI answers quote.
  const meta = input.page.metaDescription;
  const og = input.page.ogDescription;
  const metaStrong = meta.length >= 50 && meta.length <= 320;
  checks.push({
    label: "Description tags",
    state: metaStrong && og.length > 0 ? "pass" : meta.length > 0 || og.length > 0 ? "warn" : "fail",
    detail:
      meta.length === 0 && og.length === 0
        ? "no meta description or og:description"
        : `meta ${meta.length ? `${meta.length} chars` : "missing"} · og:description ${og.length ? `${og.length} chars` : "missing"}`,
  });

  // 5. Is the product proposition extractable? title + h1 + description
  //    present and reinforcing each other.
  const { title, h1 } = input.page;
  const desc = meta || og;
  const allPresent = title.length > 0 && h1.length > 0 && desc.length > 0;
  const titleTokens = significantTokens(title);
  const coherent =
    allPresent &&
    (sharesToken(titleTokens, significantTokens(h1)) ||
      sharesToken(titleTokens, significantTokens(desc)));
  checks.push({
    label: "Proposition extractable",
    state: coherent ? "pass" : allPresent ? "warn" : "fail",
    detail: coherent
      ? "title, H1 and description tell one coherent story"
      : allPresent
        ? "title, H1 and description don't reinforce each other"
        : `missing ${[title.length === 0 && "title", h1.length === 0 && "H1", desc.length === 0 && "description"].filter(Boolean).join(", ")}`,
  });

  return checks;
}

/** One-line overall verdict for the results header. */
export function aiVisibilityVerdict(checks: readonly ToolCheck[], host: string): string {
  const fails = checks.filter((c) => c.state === "fail").length;
  const warns = checks.filter((c) => c.state === "warn").length;
  if (fails === 0 && warns <= 1) return `AI search engines can see and understand ${host}.`;
  if (fails === 0) return `${host} is visible to AI search engines, but the warnings below blur the picture.`;
  if (fails <= 2) return `${host} is only partially visible — AI engines can reach it but struggle to understand it.`;
  return `${host} is mostly invisible to AI search engines right now.`;
}
