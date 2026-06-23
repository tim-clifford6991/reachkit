/**
 * /teardowns/[slug] — individual teardown page (§22.2 GEO)
 *
 * SSR: fully server-rendered — no ssr:false wrappers here.
 * JSON-LD: Article + Author (E-E-A-T) emitted in <head>.
 * generateStaticParams: builds all 5 slugs at build time.
 * notFound(): called for unknown slugs.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, articleLd, SITE } from "@/lib/seo";
import { teardownBySlug, teardownSlugs } from "@/content/teardowns";
import type { Teardown } from "@/content/teardowns";

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams(): { slug: string }[] {
  return teardownSlugs.map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const teardown = teardownBySlug(slug);
  if (!teardown) return {};

  return buildMetadata({
    title: teardown.title,
    description: teardown.blurb,
    path: `/teardowns/${slug}`,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number): string {
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-accent-400)";
  return "var(--color-warning)";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Needs Work";
  return "Critical";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components (server components — no "use client")
// ---------------------------------------------------------------------------

function ScorePanel({ teardown }: { teardown: Teardown }) {
  const colour = scoreColour(teardown.score.total);
  const label = scoreLabel(teardown.score.total);
  const { breakdown } = teardown.score;

  return (
    <div
      className="rounded-xl border p-8"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
      aria-label={`Discoverability score: ${teardown.score.total} out of 100`}
    >
      {/* Total score */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Discoverability Score
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className="font-mono text-4xl font-bold tabular-nums leading-none"
              style={{ color: colour }}
            >
              {teardown.score.total}
            </span>
            <span
              className="font-mono text-sm"
              style={{ color: "var(--color-muted)" }}
            >
              / 100
            </span>
          </div>
          <p
            className="mt-1 font-mono text-xs uppercase tracking-widest"
            style={{ color: colour }}
          >
            {label}
          </p>
        </div>

        {/* Platform badge */}
        <div
          className="shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
          style={{
            borderColor: "var(--hairline)",
            color: "var(--color-muted)",
          }}
        >
          {teardown.platform === "ios" ? "iOS App Store" : "Web"}
        </div>
      </div>

      <div
        className="my-5 h-px"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />

      {/* Breakdown bars */}
      <div className="space-y-3">
        {(
          [
            ["Content", breakdown.content],
            ["Outreach", breakdown.outreach],
            ["SEO / ASO", breakdown.seo],
          ] as const
        ).map(([label, value]) => {
          const barColour = scoreColour(value);
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                {label}
              </span>
              <div
                className="relative h-1 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--fill-subtle)" }}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label}: ${value} out of 100`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${value}%`, backgroundColor: barColour }}
                />
              </div>
              <span
                className="w-7 text-right font-mono text-xs tabular-nums"
                style={{ color: "var(--color-fg)" }}
                aria-hidden="true"
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last verified */}
      <p
        className="mt-5 font-mono text-[10px]"
        style={{ color: "var(--color-muted)", opacity: 0.6 }}
      >
        Last verified:{" "}
        <time dateTime={teardown.lastVerified}>
          {formatDate(teardown.lastVerified)}
        </time>
      </p>
    </div>
  );
}

function TeardownSections({ teardown }: { teardown: Teardown }) {
  return (
    <div className="space-y-10">
      {teardown.sections.map((section) => (
        <section key={section.heading} aria-label={section.heading}>
          <h2
            className="text-xl font-bold tracking-tight sm:text-2xl"
            style={{ color: "var(--color-fg)", lineHeight: 1.25 }}
          >
            {section.heading}
          </h2>
          <div className="mt-4 space-y-4">
            {section.body.map((para, i) => (
              <p
                key={i}
                className="text-base leading-relaxed"
                style={{ color: "var(--color-muted)" }}
              >
                {para}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TakeawaysPanel({ teardown }: { teardown: Teardown }) {
  return (
    <aside
      className="rounded-xl border p-8"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
      aria-label="Key takeaways"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        Key takeaways
      </p>
      <ol className="mt-4 space-y-3">
        {teardown.takeaways.map((takeaway, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="mt-0.5 shrink-0 font-mono text-xs tabular-nums"
              style={{ color: "var(--color-accent-400)" }}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              {takeaway}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TeardownSlugPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const teardown = teardownBySlug(slug);

  if (!teardown) {
    notFound();
  }

  const canonicalUrl = `${SITE.url}/teardowns/${slug}`;

  const ld = articleLd({
    headline: teardown.title,
    url: canonicalUrl,
    datePublished: teardown.publishedAt,
    dateModified: teardown.lastVerified,
    author: {
      name: "ReachKit",
      url: SITE.url,
    },
  });

  return (
    <>
      {/* Article + Author JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <main
        className="mx-auto max-w-[var(--spacing-content-max)] px-(--spacing-content-x) pb-24 pt-12 sm:pt-20"
        aria-label={teardown.title}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8"
        >
          <ol className="flex items-center gap-2 font-mono text-xs" style={{ color: "var(--color-muted)" }}>
            <li>
              <Link
                href="/"
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--color-muted)" }}
              >
                ReachKit
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.4 }}>/</li>
            <li>
              <Link
                href="/teardowns"
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--color-muted)" }}
              >
                Teardowns
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.4 }}>/</li>
            <li aria-current="page" style={{ color: "var(--color-fg)" }}>
              {teardown.appName}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <p
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            Discoverability teardown
          </p>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
          >
            {teardown.title}
          </h1>
          <p
            className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--color-muted)" }}
          >
            {teardown.intro}
          </p>
          <p
            className="mt-4 font-mono text-xs"
            style={{ color: "var(--color-muted)", opacity: 0.5 }}
          >
            Published{" "}
            <time dateTime={teardown.publishedAt}>
              {formatDate(teardown.publishedAt)}
            </time>
          </p>
        </header>

        {/* Two-column layout on large screens: content + sidebar */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_300px]">
          {/* Main content */}
          <div className="min-w-0">
            <TeardownSections teardown={teardown} />
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            <ScorePanel teardown={teardown} />
            <TakeawaysPanel teardown={teardown} />

            {/* CTA */}
            <div
              className="rounded-xl border p-8 text-center"
              style={{
                borderColor: "oklch(0.56 0.205 285 / 0.25)",
                background: "oklch(0.56 0.205 285 / 0.05)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--color-fg)" }}
              >
                What does your app score?
              </p>
              <p
                className="mt-1.5 text-xs leading-relaxed"
                style={{ color: "var(--color-muted)" }}
              >
                Run a free scan and see your discoverability gaps in 90 seconds.
              </p>
              <Link
                href="/scan"
                className="mt-4 inline-flex items-center rounded-lg px-4 py-2 font-mono text-sm font-semibold transition-all duration-150"
                style={{
                  background: "var(--color-accent-400)",
                  color: "var(--color-bg)",
                }}
              >
                Scan my app free
              </Link>
            </div>
          </aside>
        </div>

        {/* Back link */}
        <div className="mt-16 border-t pt-8" style={{ borderColor: "var(--fill-subtle)" }}>
          <Link
            href="/teardowns"
            className="font-mono text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--color-accent-400)" }}
          >
            ← All teardowns
          </Link>
        </div>
      </main>
    </>
  );
}
