/**
 * Free /tools mini-checker (§8, W3): a single-purpose on-page SEO checker that
 * runs the same deterministic Wave A extraction the scan uses, then funnels to
 * the full Discoverability Score. Linkable/rankable acquisition asset.
 */

import { Suspense } from "react";
import { headers } from "next/headers";
import { extractHtmlSignals, type HtmlSignals } from "@/lib/scan/extract-html";
import { buildMetadata } from "@/lib/seo";
import type { ToolCheck } from "@/lib/tools/ai-visibility";
import { checkToolRateLimit, ipFromHeaderStore } from "@/lib/tools/rate-limit";
import { fetchToolPage, normalizeToolUrl } from "@/lib/tools/safe-fetch";
import { CheckList, ScanCta, ToolForm, ToolHeader, ToolNote, ToolShell } from "../tool-ui";

export const metadata = buildMetadata({
  title: "Free on-page SEO checker — test any page in seconds",
  description:
    "Check the 8 on-page signals search engines read: title tag, meta description, JSON-LD structured data, canonical, headings, Open Graph tags, content depth and image alt text. Free, no signup.",
  path: "/tools/on-page-check",
});

function buildChecks(s: HtmlSignals): ToolCheck[] {
  const lenState = (present: boolean, len: number, lo: number, hi: number): ToolCheck["state"] =>
    !present ? "fail" : len >= lo && len <= hi ? "pass" : "warn";
  return [
    { label: "Title tag", state: lenState(s.title.present, s.title.length, 30, 60), detail: s.title.present ? `${s.title.length} chars (ideal 30–60)` : "missing" },
    { label: "Meta description", state: lenState(s.metaDescription.present, s.metaDescription.length, 120, 160), detail: s.metaDescription.present ? `${s.metaDescription.length} chars (ideal 120–160)` : "missing" },
    { label: "Structured data (JSON-LD)", state: s.jsonLd.present ? "pass" : "fail", detail: s.jsonLd.present ? s.jsonLd.types.join(", ") || "present" : "none found" },
    { label: "Canonical URL", state: s.canonical.present ? "pass" : "fail", detail: s.canonical.present ? "present" : "missing" },
    { label: "Heading structure", state: s.headings.wellStructured ? "pass" : s.headings.h1Count >= 1 ? "warn" : "fail", detail: `${s.headings.h1Count} H1 · ${s.headings.h2Count} H2` },
    { label: "Open Graph / social tags", state: s.openGraph.present && s.openGraph.hasImage ? "pass" : s.openGraph.present ? "warn" : "fail", detail: s.openGraph.present ? (s.openGraph.hasImage ? "complete" : "no og:image") : "missing" },
    { label: "Content depth", state: s.wordCount >= 300 ? "pass" : s.wordCount >= 120 ? "warn" : "fail", detail: `${s.wordCount.toLocaleString()} words` },
    { label: "Image alt coverage", state: s.images.count === 0 ? "warn" : s.images.altCoverage >= 0.8 ? "pass" : "warn", detail: s.images.count === 0 ? "no images" : `${Math.round(s.images.altCoverage * 100)}% have alt` },
  ];
}

async function CheckResult({ url }: { url: string }) {
  const normalized = normalizeToolUrl(url);
  if (!normalized) {
    return <ToolNote>That doesn&apos;t look like a website URL — try something like <span style={{ fontFamily: "var(--font-mono)" }}>yoursite.com</span>.</ToolNote>;
  }

  const ip = ipFromHeaderStore(await headers());
  if (!checkToolRateLimit(ip)) {
    return <ToolNote>You&apos;ve hit the hourly limit for free checks — try again in a bit, or run a full scan instead.</ToolNote>;
  }

  const page = await fetchToolPage(normalized);
  if (!page || page.html.length === 0) {
    return (
      <ToolNote>
        Couldn&apos;t fetch <span style={{ fontFamily: "var(--font-mono)" }}>{normalized}</span> — check the URL and try again.
      </ToolNote>
    );
  }

  const checks = buildChecks(extractHtmlSignals(page.html.slice(0, 200_000)));
  const passed = checks.filter((c) => c.state === "pass").length;

  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-muted)", margin: 0 }}>
        {passed}/{checks.length} checks passing for <span style={{ color: "var(--c-ink)" }}>{normalized}</span>
      </p>
      <CheckList checks={checks} />
      <ScanCta
        url={normalized}
        line="This is 8 of the on-page signals in the full ReachKit scan. See your full Discoverability Score across search, AI answers, content and competitors — free, no account."
      />
    </div>
  );
}

async function CheckForm({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <ToolForm defaultValue={url} />
      {url && <CheckResult url={url} />}
    </>
  );
}

export default function OnPageCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  return (
    <ToolShell>
      <ToolHeader
        title="On-page SEO checker"
        intro="Paste a URL — we'll check the on-page signals search engines read: title, meta description, structured data, headings, social tags, content depth and alt text. No signup."
      />
      <Suspense fallback={<ToolNote>Loading…</ToolNote>}>
        <CheckForm searchParams={searchParams} />
      </Suspense>
    </ToolShell>
  );
}
