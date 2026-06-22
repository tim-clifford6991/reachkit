/**
 * Free /tools mini-checker (§8): a single-purpose on-page SEO checker that runs
 * the same deterministic Wave A extraction the scan uses, then funnels to the
 * full Discoverability Score. Linkable/rankable acquisition asset.
 */

import { Suspense } from "react";
import Link from "next/link";
import { extractHtmlSignals, type HtmlSignals } from "@/lib/scan/extract-html";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Free on-page SEO checker",
  path: "/tools/on-page-check",
});

type Check = { label: string; state: "pass" | "warn" | "fail"; detail: string };

function buildChecks(s: HtmlSignals): Check[] {
  const lenState = (present: boolean, len: number, lo: number, hi: number): Check["state"] =>
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

const DOT: Record<Check["state"], string> = {
  pass: "var(--color-success)",
  warn: "var(--color-warning)",
  fail: "var(--color-danger)",
};

async function CheckResult({ url }: { url: string }) {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let html: string | null = null;
  try {
    const res = await fetch(normalized, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ReachKit on-page checker" },
    });
    html = await res.text();
  } catch {
    html = null;
  }

  if (!html) {
    return (
      <p className="mt-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Couldn&apos;t fetch <span className="font-mono">{normalized}</span> — check the URL and try again.
      </p>
    );
  }

  const checks = buildChecks(extractHtmlSignals(html.slice(0, 200_000)));
  const passed = checks.filter((c) => c.state === "pass").length;

  return (
    <div className="mt-6 space-y-4">
      <p className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
        {passed}/{checks.length} checks passing for <span style={{ color: "var(--color-fg)" }}>{normalized}</span>
      </p>
      <ul className="divide-y rounded-2xl border" style={{ borderColor: "var(--hairline)" }}>
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: "var(--hairline)" }}>
            <span className="flex items-center gap-2.5">
              <span className="size-2 rounded-full" style={{ background: DOT[c.state] }} aria-hidden />
              <span className="text-sm" style={{ color: "var(--color-fg)" }}>{c.label}</span>
            </span>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-muted)" }}>{c.detail}</span>
          </li>
        ))}
      </ul>
      <div
        className="rounded-2xl border px-5 py-4 text-center"
        style={{ borderColor: "var(--color-accent-900)", background: "var(--color-accent-subtle)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-fg)" }}>
          This is 8 of 18 signals. See your full Discoverability Score across Content, Outreach &amp; SEO.
        </p>
        <Link
          href={`/scan?url=${encodeURIComponent(normalized)}`}
          className="mt-2 inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold"
          style={{ background: "var(--color-accent-600)", color: "var(--color-accent-fg)" }}
        >
          Get your full score →
        </Link>
      </div>
    </div>
  );
}

async function CheckForm({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <form method="GET" className="mt-6 flex gap-2">
        <input
          name="url"
          type="text"
          defaultValue={url}
          placeholder="https://yoursite.com"
          className="h-11 flex-1 rounded-lg border border-input bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg px-5 text-sm font-semibold"
          style={{ background: "var(--color-accent-600)", color: "var(--color-accent-fg)" }}
        >
          Check
        </button>
      </form>
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
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
        Free tool
      </p>
      <h1 className="mt-1 text-3xl font-semibold" style={{ color: "var(--color-fg)" }}>
        On-page SEO checker
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Paste a URL — we&apos;ll check the on-page signals search engines read (title, meta,
        structured data, headings, social tags, content depth, alt text). No signup.
      </p>

      <Suspense
        fallback={
          <p className="mt-6 font-mono text-xs" style={{ color: "var(--color-muted)" }}>
            Loading…
          </p>
        }
      >
        <CheckForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
