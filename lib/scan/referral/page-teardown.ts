/**
 * Ranking-page teardown — "HOW is this competitor ranking so highly for X?"
 *
 * For a given ranking URL + keyword, decomposes the two things that decide a
 * ranking: the PAGE (content type, title/H1, depth, keyword usage) and the
 * OFF-PAGE strength (backlinks pointing to THAT specific page). Then an LLM
 * synthesizes the "why it ranks" so the user knows what to replicate.
 */
import { parse } from "node-html-parser";
import { callModel } from "@/lib/llm/anthropic";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { cachedBacklinks } from "@/lib/scan/cache/cached-adapters";
import { isNoiseHost } from "@/lib/scan/referral/classify";

export interface PageTeardown {
  url: string;
  keyword: string;
  fetched: boolean;
  contentType: "blog/article" | "landing/product" | "tool" | "docs/support" | "comparison/listicle" | "other";
  title: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInBody: boolean;
  /** Backlinks pointing to THIS exact page (the off-page strength behind the rank). */
  pageReferringDomains: number;
  topPageReferrers: Array<{ host: string; url: string }>;
  whyItRanks: string;
}

function inferContentType(url: string, h1: string[]): PageTeardown["contentType"] {
  const u = url.toLowerCase();
  if (/\/blog\/|\/articles?\/|\/guides?\/|\/resources?\//.test(u)) return "blog/article";
  if (/\b(vs|alternatives?|best|comparison|top-\d)\b/.test(u)) return "comparison/listicle";
  if (/\/docs?\/|\/help\/|\/support\/|\/kb\//.test(u)) return "docs/support";
  if (/\/tools?\/|\/generator|\/calculator|\/free-/.test(u)) return "tool";
  // root or shallow product path with few headings → landing
  try {
    const path = new URL(u).pathname.replace(/\/$/, "");
    if (path === "" || path.split("/").filter(Boolean).length <= 1) return "landing/product";
  } catch { /* ignore */ }
  return h1.length ? "other" : "other";
}

async function fetchPage(url: string): Promise<{ title: string; h1: string[]; h2: string[]; wordCount: number; body: string } | null> {
  try {
    const res = await fetchWithTimeout(url, { redirect: "follow" }, 10_000);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 800_000);
    const root = parse(html);
    const title = root.querySelector("title")?.text?.trim() ?? "";
    const h1 = root.querySelectorAll("h1").map((e) => e.text.trim()).filter(Boolean).slice(0, 3);
    const h2 = root.querySelectorAll("h2").map((e) => e.text.trim()).filter(Boolean).slice(0, 10);
    const body = (root.querySelector("body")?.text ?? "").replace(/\s+/g, " ").trim();
    const wordCount = body ? body.split(" ").length : 0;
    return { title, h1, h2, wordCount, body };
  } catch {
    return null;
  }
}

export async function teardownRankingPage(rawUrl: string, keyword: string): Promise<PageTeardown> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const kw = keyword.toLowerCase();

  // Page anatomy + page-level backlinks, in parallel.
  const [page, refs] = await Promise.all([fetchPage(url), cachedBacklinks(url, 100)]);

  const seen = new Set<string>();
  const topPageReferrers: Array<{ host: string; url: string }> = [];
  for (const r of refs) {
    const h = r.referringHost;
    if (!h || isNoiseHost(h) || seen.has(h)) continue;
    seen.add(h);
    if (topPageReferrers.length < 12) topPageReferrers.push({ host: h, url: r.referringUrl });
  }

  const title = page?.title ?? "";
  const h1 = page?.h1 ?? [];
  const h2 = page?.h2 ?? [];
  const contentType = inferContentType(url, h1);
  const keywordInTitle = title.toLowerCase().includes(kw);
  const keywordInH1 = h1.some((h) => h.toLowerCase().includes(kw));
  const keywordInBody = !!page && page.body.toLowerCase().includes(kw);

  const whyItRanks = await synthWhy({
    url, keyword, contentType, title, h1, h2, wordCount: page?.wordCount ?? 0,
    keywordInTitle, keywordInH1, keywordInBody,
    pageReferringDomains: seen.size, topReferrers: topPageReferrers,
  });

  return {
    url, keyword, fetched: !!page, contentType, title, h1, h2,
    wordCount: page?.wordCount ?? 0, keywordInTitle, keywordInH1, keywordInBody,
    pageReferringDomains: seen.size, topPageReferrers, whyItRanks,
  };
}

async function synthWhy(i: {
  url: string; keyword: string; contentType: string; title: string; h1: string[]; h2: string[];
  wordCount: number; keywordInTitle: boolean; keywordInH1: boolean; keywordInBody: boolean;
  pageReferringDomains: number; topReferrers: Array<{ host: string }>;
}): Promise<string> {
  const prompt = `Explain in 2–3 sentences WHY this page ranks well for the keyword "${i.keyword}", and what a founder would need to replicate it.

PAGE: ${i.url}
- type: ${i.contentType}
- title: ${i.title || "(none)"}
- H1: ${i.h1.join(" | ") || "(none)"}
- sample H2s: ${i.h2.slice(0, 6).join(" | ") || "(none)"}
- word count: ${i.wordCount}
- keyword in title: ${i.keywordInTitle}, in H1: ${i.keywordInH1}, in body: ${i.keywordInBody}
- backlinks to THIS page: ${i.pageReferringDomains} referring domains${i.topReferrers.length ? ` (e.g. ${i.topReferrers.slice(0, 5).map((r) => r.host).join(", ")})` : ""}

Be concrete: is it ranking on on-page relevance, content depth, backlink strength, or a mix? What's the replicable move? Plain prose, no preamble.`;
  try {
    const { text } = await callModel({
      model: "claude-haiku-4-5-20251001",
      system: "You are an SEO analyst explaining concretely why a specific page ranks, and what to replicate. 2–3 sentences, plain prose.",
      prompt,
      scanId: null,
      stage: "synth",
    });
    return text.trim();
  } catch {
    return "";
  }
}
