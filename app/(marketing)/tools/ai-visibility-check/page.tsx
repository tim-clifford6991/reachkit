/**
 * Free AI visibility check (W3): can AI search engines (ChatGPT, Claude,
 * Perplexity, Gemini) see and understand this product? Three server-side
 * fetches — homepage, /llms.txt, /robots.txt — graded by pure logic in
 * lib/tools/ai-visibility.ts, then funneled into the full scan.
 */

import { Suspense } from "react";
import { headers } from "next/headers";
import { buildMetadata } from "@/lib/seo";
import {
  aiVisibilityVerdict,
  buildAiVisibilityChecks,
  extractAiPageSignals,
} from "@/lib/tools/ai-visibility";
import { checkToolRateLimit, ipFromHeaderStore } from "@/lib/tools/rate-limit";
import { fetchSiteTextFile, fetchToolPage, normalizeToolUrl } from "@/lib/tools/safe-fetch";
import { CheckList, ScanCta, ToolForm, ToolHeader, ToolNote, ToolShell } from "../tool-ui";

export const metadata = buildMetadata({
  title: "AI visibility check — can ChatGPT & Claude see your website?",
  description:
    "Free AI visibility checker: test your llms.txt, robots.txt rules for GPTBot, ClaudeBot, PerplexityBot & Google-Extended, structured data and meta tags — see if AI search engines can find and understand your product.",
  path: "/tools/ai-visibility-check",
});

async function CheckResult({ url }: { url: string }) {
  const normalized = normalizeToolUrl(url);
  if (!normalized) {
    return <ToolNote>That doesn&apos;t look like a website URL — try something like <span style={{ fontFamily: "var(--font-mono)" }}>yoursite.com</span>.</ToolNote>;
  }

  const ip = ipFromHeaderStore(await headers());
  if (!checkToolRateLimit(ip)) {
    return <ToolNote>You&apos;ve hit the hourly limit for free checks — try again in a bit, or run a full scan instead.</ToolNote>;
  }

  const origin = new URL(normalized).origin;
  const [page, llmsTxt, robots] = await Promise.all([
    fetchToolPage(normalized),
    fetchSiteTextFile(origin, "/llms.txt"),
    fetchSiteTextFile(origin, "/robots.txt"),
  ]);

  if (!page || page.html.length === 0) {
    return (
      <ToolNote>
        Couldn&apos;t fetch <span style={{ fontFamily: "var(--font-mono)" }}>{normalized}</span> — check the URL and try again.
      </ToolNote>
    );
  }

  const checks = buildAiVisibilityChecks({
    llmsTxt,
    robotsTxt: robots.exists ? robots.text : null,
    page: extractAiPageSignals(page.html),
  });
  const host = new URL(normalized).hostname.replace(/^www\./, "");
  const verdict = aiVisibilityVerdict(checks, host);
  const passed = checks.filter((c) => c.state === "pass").length;

  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", lineHeight: 1.35, color: "var(--c-ink)", margin: 0 }}>
        {verdict}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-muted)", margin: "8px 0 0" }}>
        {passed}/{checks.length} checks passing for <span style={{ color: "var(--c-ink)" }}>{host}</span>
      </p>
      <CheckList checks={checks} />
      <ScanCta
        url={normalized}
        line="This is 5 of the 18 signals ReachKit scores — run the full scan to see how you show up in search, AI answers and against your competitors. Free, no account."
      />
    </div>
  );
}

async function CheckForm({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <ToolForm defaultValue={url} buttonLabel="Check visibility" />
      {url && <CheckResult url={url} />}
    </>
  );
}

export default function AiVisibilityCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  return (
    <ToolShell>
      <ToolHeader
        title="AI visibility check"
        intro="AI search engines answer buyer questions from what they can crawl and parse. Paste your URL — we'll check your llms.txt, robots.txt rules for GPTBot, ClaudeBot, PerplexityBot and Google-Extended, your structured data, and whether your product proposition is actually machine-readable. No signup."
      />
      <Suspense fallback={<ToolNote>Loading…</ToolNote>}>
        <CheckForm searchParams={searchParams} />
      </Suspense>
    </ToolShell>
  );
}
