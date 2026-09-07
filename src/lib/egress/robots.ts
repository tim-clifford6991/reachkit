// BUILD §6.4
// src/lib/egress/robots.ts — `readRobots`, robots.txt and its per-agent
// verdicts (BP-006 `## Public interface`, issue #22).
//
// Reads one origin's `/robots.txt` through `safeFetch` — the robots document
// itself is the one fetch not gated by robots (`respectRobots: false`), or
// nothing could ever be read — and parses it group by group (RFC 9309) into
// the `RobotsPolicy` declared in `types.ts`. It is a parse of a fetched
// document, never a judgement about it: what each verdict means for the
// blocked-readers count is `src/lib/measure/verdict.ts`'s.
//
// Three answers, never collapsed (BP-006 error behaviour):
//   - could not read it at all (transport failure, policy refusal, 5xx,
//     429) → `{ ok: false, reason }` — "could not determine". `safeFetch`
//     treats this as no policy known and never fabricates a disallow.
//   - read it and the origin has none (404 or any other 4xx, RFC 9309
//     §2.3.1.3 "unavailable") → a policy with `absent: true` and empty
//     verdicts — a read with nothing in it, REQ-004 c7's zero.
//   - read it and it says something (2xx) → `absent: false`, verdicts filled.
//
// **Keying of `disallowedAgents` (chosen here, recorded once).** BP-006 says
// "keyed by the token as written in the document, lowercased" and that the
// closed set `AI_READER_AGENTS` "is applied by the caller, not here". The
// caller that applies it (`verdict.ts`) reads the map by the pinned
// spelling (`GPTBot`, not `gptbot`). Both are honoured: a document token
// that names a pinned reader — matched case-insensitively, as RFC 9309
// requires of product tokens — is keyed by the pinned spelling; every other
// token is keyed lowercased. The membership list is read from
// `constants.ts`, never restated here (ADR-022, ADR-090).
//
// Verdicts are at the origin root (`/`), which is all `RobotsPolicy`
// declares; longest-match wins, `Allow` wins a tie, `*` and `$` are the only
// pattern characters (RFC 9309 §2.2.2–2.2.3).
import { AI_READER_AGENTS } from "@/lib/config/constants";
import { memoiseRobots } from "./robots-memo";
import { safeFetch } from "./safe-fetch";
import type { RobotsPolicy } from "./types";

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };

/** The parsed verdicts of one document — everything in `RobotsPolicy` that
 *  comes from the text rather than from the fetch. Exported for direct
 *  parser tests; production callers use `readRobots`. */
export type RobotsVerdicts = Pick<RobotsPolicy, "disallowsAll" | "disallowedAgents" | "sitemaps">;

const ROOT_PATH = "/";

const PINNED_BY_LOWER: ReadonlyMap<string, string> = new Map(
  AI_READER_AGENTS.map((token) => [token.toLowerCase(), token] as const)
);

/** RFC 9309 §2.2.3: `*` matches any run of characters, a trailing `$`
 *  anchors the end; everything else is literal. Anchored at the start. */
function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

/** Longest matching rule decides; an `Allow` wins a tie; no match allows. */
function rootDisallowed(rules: readonly Rule[]): boolean {
  let best: Rule | undefined;
  for (const rule of rules) {
    if (rule.pattern === "") continue; // `Disallow:` with no value disallows nothing
    if (!patternMatches(rule.pattern, ROOT_PATH)) continue;
    if (
      best === undefined ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return best !== undefined && !best.allow;
}

/** Product token of a `User-agent:` value — the part before any `/`,
 *  lowercased (RFC 9309 §2.2.1: tokens compare case-insensitively). The one
 *  place the key format is decided: `safe-fetch.ts` reads the map back with
 *  this same function, so the two can never disagree about a key. */
export function productToken(value: string): string {
  return (value.split("/")[0] ?? "").trim().toLowerCase();
}

/** Parses one robots.txt body into its origin-root verdicts. Pure. */
export function parseRobotsTxt(text: string): RobotsVerdicts {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line === "") continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "sitemap") {
      if (value !== "") sitemaps.push(value);
      continue; // group-independent, and never fetched (BUILD §17: no sitemap reader)
    }
    if (key === "user-agent") {
      const token = productToken(value);
      if (token === "") continue;
      if (current === null || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(token);
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current === null) continue; // rules before any group are ignored (RFC 9309 §2.2.1)
    if (key === "allow" || key === "disallow") {
      current.rules.push({ allow: key === "allow", pattern: value });
    }
    // any other key: unknown directive, ignored
  }

  // RFC 9309 §2.2.1: groups naming the same token are merged.
  const rulesByToken = new Map<string, Rule[]>();
  for (const group of groups) {
    for (const agent of group.agents) {
      const existing = rulesByToken.get(agent);
      if (existing) existing.push(...group.rules);
      else rulesByToken.set(agent, [...group.rules]);
    }
  }

  const disallowedAgents: Record<string, boolean> = {};
  for (const [token, rules] of rulesByToken) {
    disallowedAgents[PINNED_BY_LOWER.get(token) ?? token] = rootDisallowed(rules);
  }
  const wildcard = rulesByToken.get("*");

  return {
    disallowsAll: wildcard !== undefined && rootDisallowed(wildcard),
    disallowedAgents: Object.freeze(disallowedAgents),
    sitemaps: Object.freeze(sitemaps),
  };
}

const ABSENT_VERDICTS: RobotsVerdicts = Object.freeze({
  disallowsAll: false,
  disallowedAgents: Object.freeze({}),
  sitemaps: Object.freeze([]),
});

/**
 * BP-006 `readRobots(origin)`. Never throws.
 *
 * **Read once per origin per scan** (issue #73). Inside a cost context the
 * answer is memoised for that context's lifetime; outside one — a direct
 * call, the publish verifier, a test — this is `readOrigin` and nothing
 * else, with no lookup, no write and no behaviour change.
 *
 * The memo sits here rather than at `safe-fetch.ts`'s robots port because
 * two callers read the same origin during one pass: the port, on every page
 * fetch and every redirect hop, and `src/lib/measure/index.ts` directly for
 * the home document. A memo at the port would leave the second unmemoised
 * and "at most once" would be false by one.
 *
 * The key is `URL.origin`, so two spellings of one origin are one entry and
 * a malformed one never reaches the memo at all.
 */
export async function readRobots(origin: string): Promise<RobotsPolicy | { ok: false; reason: string }> {
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return { ok: false, reason: `origin '${origin}' is not a URL` };
  }
  return memoiseRobots(base.origin, () => readOrigin(base));
}

/** One origin's document, fetched and parsed — the whole of what a read
 *  does, with nothing about how often it happens. */
async function readOrigin(base: URL): Promise<RobotsPolicy | { ok: false; reason: string }> {
  const outcome = await safeFetch(new URL("/robots.txt", base.origin).toString(), {
    respectRobots: false, // the robots document is the one fetch robots cannot gate
    userAgent: "reachkit-measure",
  });

  if (!outcome.ok) {
    return { ok: false, reason: `robots.txt could not be read: ${outcome.reason}` };
  }

  const { status, readAt } = outcome;
  const common = { ok: true as const, origin: base.origin, readAt };

  if (status >= 200 && status < 300) {
    return { ...common, absent: false, ...parseRobotsTxt(outcome.html) };
  }
  if (status >= 400 && status < 500 && status !== 429) {
    // RFC 9309 §2.3.1.3 "unavailable": a read with nothing in it.
    return { ...common, absent: true, ...ABSENT_VERDICTS };
  }
  // 5xx, 429, or anything else: the server did not tell us — undeterminable.
  return { ok: false, reason: `robots.txt answered status ${status}` };
}
