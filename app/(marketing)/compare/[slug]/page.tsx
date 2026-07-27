/**
 * /compare/[slug] — full differentiator page per competitor. Thin renderer over
 * the compare-content registry: hero, deep prose sections, a "use both / choose
 * ReachKit" verdict, the capability table, and the free-scan CTA. Pure server
 * component in the kit idiom (inline var(--c-*) styles, three font vars).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";
import {
  COMPARE_MAP,
  COMPARE_SLUGS,
  type CompareCell,
  type CompareEntry,
} from "../compare-content";

const SG = "var(--font-display)", JM = "var(--font-mono)", SANS = "var(--font-sans)";

export function generateStaticParams() {
  return COMPARE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPARE_MAP[slug];
  if (!c) return {};
  return buildMetadata({
    title: `ReachKit vs ${c.name} — ${c.titleTail}`,
    description: c.metaDescription,
    path: `/compare/${slug}`,
  });
}

function CellMark({ cell, highlight }: { cell: CompareCell; highlight: boolean }) {
  if (cell.type === "check") {
    return (
      <span aria-label="Yes" style={{ fontFamily: JM, fontWeight: 700, fontSize: 15, color: highlight ? "var(--c-action)" : "var(--c-band-findable)" }}>
        ✓
      </span>
    );
  }
  if (cell.type === "cross") {
    return (
      <span aria-label="No" style={{ fontFamily: JM, fontWeight: 600, fontSize: 15, color: "var(--c-faint)" }}>
        ✕
      </span>
    );
  }
  return (
    <span style={{ fontFamily: JM, fontSize: 11.5, lineHeight: 1.35, color: "var(--c-muted)", display: "inline-block", maxWidth: 170 }}>
      {cell.note}
    </span>
  );
}

function CapabilityTable({ c }: { c: CompareEntry }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--c-line)", borderRadius: 16, background: "var(--c-surface)" }}>
      <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left", padding: "14px 18px", fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-faint)", borderBottom: "1px solid var(--c-line)" }}>
              Capability
            </th>
            <th scope="col" style={{ textAlign: "center", padding: "14px 16px", fontFamily: SG, fontSize: 13.5, fontWeight: 700, color: "var(--c-action)", borderBottom: "1px solid var(--c-line)", background: "var(--c-tint-violet)" }}>
              ReachKit
            </th>
            <th scope="col" style={{ textAlign: "center", padding: "14px 16px", fontFamily: SG, fontSize: 13.5, fontWeight: 700, color: "var(--c-ink)", borderBottom: "1px solid var(--c-line)" }}>
              {c.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {c.rows.map((row, i) => {
            const last = i === c.rows.length - 1;
            const border = last ? "none" : "1px solid var(--c-line2)";
            return (
              <tr key={row.capability}>
                <th scope="row" style={{ textAlign: "left", padding: "13px 18px", fontFamily: SANS, fontSize: 14, fontWeight: 500, color: "var(--c-ink)", borderBottom: border }}>
                  {row.capability}
                </th>
                <td style={{ textAlign: "center", padding: "13px 16px", borderBottom: border, background: "var(--c-tint-violet)" }}>
                  <CellMark cell={row.cells[0]} highlight />
                </td>
                <td style={{ textAlign: "center", padding: "13px 16px", borderBottom: border }}>
                  <CellMark cell={row.cells[1]} highlight={false} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VerdictList({ title, items, accent }: { title: string; items: readonly string[]; accent: boolean }) {
  return (
    <div style={{ flex: "1 1 300px", background: accent ? "var(--c-tint-violet)" : "var(--c-surface)", border: `1px solid ${accent ? "var(--c-tint-violet-line)" : "var(--c-line)"}`, borderRadius: 16, padding: "24px 26px" }}>
      <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: accent ? "var(--c-action)" : "var(--c-ink)", margin: 0 }}>
        {title}
      </h3>
      <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {items.map((item) => (
          <li key={item} style={{ display: "flex", gap: 10, fontSize: 14.5, lineHeight: 1.5, color: "var(--c-muted)" }}>
            <span aria-hidden style={{ fontFamily: JM, fontWeight: 700, color: accent ? "var(--c-action)" : "var(--c-faint)", flexShrink: 0 }}>—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function CompareSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = COMPARE_MAP[slug];
  // Unknown slug (e.g. a bot probing /compare/null). notFound() here 500s under
  // Cache Components ("Invalid revalidate configuration provided: 0 < 1" — the
  // not-found boundary crashes on the on-demand-params render path before the
  // 404 renders; `dynamicParams = false` is not an option because segment-config
  // exports are rejected under cacheComponents). Same class fixed for teardowns
  // in #86 — comparisons are a fixed editorial set, so redirect probes to the
  // /compare hub: no 500, no orphan URL. Guarded by unknown-slug-redirect.test.tsx.
  if (!c) redirect("/compare");

  return (
    <main aria-label={`ReachKit versus ${c.name}`} style={{ background: "var(--c-surface)" }}>
      {/* Hero */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "70px 28px 16px", textAlign: "center" }}>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
          Compare · {c.tagline}
        </p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4vw, 3.25rem)", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--c-ink)", margin: "16px 0 0" }}>
          ReachKit vs {c.name}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", margin: "20px auto 0", maxWidth: 640 }}>
          {c.intro}
        </p>
      </section>

      {/* Deep sections */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "28px 28px 8px" }}>
        {c.sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 23, letterSpacing: "-0.015em", color: "var(--c-ink)", margin: "0 0 14px" }}>
              {s.heading}
            </h2>
            {s.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--c-muted)", margin: "0 0 14px" }}>
                {p}
              </p>
            ))}
          </div>
        ))}
      </section>

      {/* Verdict */}
      <section aria-label="Verdict" style={{ maxWidth: 880, margin: "0 auto", padding: "8px 28px 12px" }}>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 14px" }}>
          The honest verdict
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <VerdictList title={`Use ${c.name} when…`} items={c.useBothWhen} accent={false} />
          <VerdictList title="Choose ReachKit when…" items={c.chooseReachKitWhen} accent />
        </div>
      </section>

      {/* Capability table */}
      <section aria-label="Capability comparison" style={{ maxWidth: 880, margin: "0 auto", padding: "36px 28px 8px" }}>
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 14px" }}>
          Capability by capability
        </p>
        <CapabilityTable c={c} />
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "48px 28px 90px", textAlign: "center" }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.015em", color: "var(--c-ink)", margin: 0 }}>
          See the difference on your own product
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--c-muted)", margin: "12px auto 0", maxWidth: 480 }}>
          One free scan: your 0–100 discoverability score, the findings behind it, and the part {c.name} leaves to you — a ranked plan, verified live.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            href="/scan"
            style={{ display: "inline-block", background: "var(--c-action)", color: "var(--c-on-dark)", borderRadius: 10, padding: "12px 24px", fontFamily: SANS, fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}
          >
            See your Discoverability Score — free
          </Link>
        </div>
        <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", margin: "14px 0 0" }}>
          Free scan · then €59/mo Solo or €129/mo Growth
        </p>
      </section>
    </main>
  );
}
