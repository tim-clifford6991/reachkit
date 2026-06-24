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

// Font CSS vars (already loaded). Matches the harmonized index/compare pages.
const SG = "var(--font-display)";
const JM = "var(--font-mono)";
const SANS = "var(--font-sans)";

// Score → band color (Claude Design ramp: red → orange → gold → green).
function scoreColour(score: number): string {
  if (score < 35) return "#E5484D";
  if (score < 55) return "#E0731C";
  if (score < 70) return "#C98A12";
  return "#1F9D5B";
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
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-line)",
        borderRadius: 16,
        padding: "22px 24px",
      }}
      aria-label={`Discoverability score: ${teardown.score.total} out of 100`}
    >
      {/* Total score */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            style={{
              fontFamily: JM,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--c-faint)",
              margin: 0,
            }}
          >
            Discoverability Score
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              style={{
                fontFamily: JM,
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1,
                color: colour,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {teardown.score.total}
            </span>
            <span
              style={{ fontFamily: JM, fontSize: 14, color: "var(--c-faint)" }}
            >
              / 100
            </span>
          </div>
          <p
            className="mt-1"
            style={{
              fontFamily: JM,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: colour,
              margin: "4px 0 0",
            }}
          >
            {label}
          </p>
        </div>

        {/* Platform badge */}
        <div
          className="shrink-0"
          style={{
            border: "1px solid var(--c-line)",
            borderRadius: 8,
            padding: "5px 10px",
            fontFamily: JM,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--c-faint)",
          }}
        >
          {teardown.platform === "ios" ? "iOS App Store" : "Web"}
        </div>
      </div>

      <div
        className="my-5 h-px"
        style={{ background: "var(--c-line)" }}
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
                className="w-16 shrink-0"
                style={{
                  fontFamily: JM,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--c-faint)",
                }}
              >
                {label}
              </span>
              <div
                className="relative h-1 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--c-line)" }}
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
                className="w-7 text-right"
                style={{
                  fontFamily: JM,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--c-ink)",
                  fontVariantNumeric: "tabular-nums",
                }}
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
        className="mt-5"
        style={{
          fontFamily: JM,
          fontSize: 11,
          color: "var(--c-faint)",
        }}
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
            className="text-xl sm:text-2xl"
            style={{
              fontFamily: SG,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--c-ink)",
              lineHeight: 1.25,
            }}
          >
            {section.heading}
          </h2>
          <div className="mt-4 space-y-4">
            {section.body.map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "#3A3744",
                }}
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
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-line)",
        borderRadius: 16,
        padding: "22px 24px",
      }}
      aria-label="Key takeaways"
    >
      <p
        style={{
          fontFamily: JM,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--c-action)",
          margin: 0,
        }}
      >
        Key takeaways
      </p>
      <ol className="mt-4 space-y-3">
        {teardown.takeaways.map((takeaway, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="mt-0.5 shrink-0"
              style={{
                fontFamily: JM,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--c-action)",
                fontVariantNumeric: "tabular-nums",
              }}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)" }}
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
        style={{ background: "var(--c-surface)" }}
        aria-label={teardown.title}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8"
        >
          <ol
            className="flex items-center gap-2"
            style={{
              fontFamily: JM,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--c-faint)",
            }}
          >
            <li>
              <Link
                href="/"
                className="transition-opacity hover:opacity-70"
                style={{ color: "var(--c-faint)" }}
              >
                ReachKit
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.4 }}>/</li>
            <li>
              <Link
                href="/teardowns"
                className="transition-opacity hover:opacity-70"
                style={{ color: "var(--c-faint)" }}
              >
                Teardowns
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.4 }}>/</li>
            <li aria-current="page" style={{ color: "var(--c-ink)" }}>
              {teardown.appName}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <p
            className="mb-3"
            style={{
              fontFamily: JM,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--c-action)",
              margin: "0 0 12px",
            }}
          >
            Discoverability teardown
          </p>
          <h1
            className="text-3xl sm:text-4xl"
            style={{
              fontFamily: SG,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--c-ink)",
              lineHeight: 1.1,
            }}
          >
            {teardown.title}
          </h1>
          <p
            className="mt-4 max-w-2xl"
            style={{ fontSize: 16, lineHeight: 1.6, color: "var(--c-muted)" }}
          >
            {teardown.intro}
          </p>
          <p
            className="mt-4"
            style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}
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
              className="text-center"
              style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-line)",
                borderRadius: 16,
                padding: "22px 24px",
              }}
            >
              <p
                style={{
                  fontFamily: SG,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontSize: 16,
                  color: "var(--c-ink)",
                  margin: 0,
                }}
              >
                What does your app score?
              </p>
              <p
                className="mt-1.5"
                style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)" }}
              >
                Run a free scan and see your discoverability gaps in 90 seconds.
              </p>
              <Link
                href="/scan"
                className="mt-4 inline-flex items-center"
                style={{
                  background: "var(--c-action)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "11px 20px",
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Scan my app free
              </Link>
            </div>
          </aside>
        </div>

        {/* Back link */}
        <div className="mt-16 pt-8" style={{ borderTop: "1px solid var(--c-line)" }}>
          <Link
            href="/teardowns"
            className="transition-opacity hover:opacity-70"
            style={{
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--c-action)",
            }}
          >
            ← All teardowns
          </Link>
        </div>
      </main>
    </>
  );
}
