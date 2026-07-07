"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicScan } from "@/lib/scan/public-scans";

// Design idiom: Claude Design flat cards — Space Grotesk display, mono eyebrow.
const SG = "var(--font-display)", JM = "var(--font-mono)", PJ = "var(--font-sans)";

/** Score → band color (red → orange → gold → green). Mirrors the page ramp. */
function scoreColor(s: number): string {
  if (s < 35) return "#E5484D";
  if (s < 55) return "#E0731C";
  if (s < 70) return "#C98A12";
  return "#1F9D5B";
}

/**
 * The single scans grid: every completed scan as a card (logo + score +
 * positioning-gap blurb, linking to its public /scan/<slug> report), with an
 * INSTANT client-side filter — results narrow as you type. Client component so
 * the search is zero-latency over the already-loaded set.
 */
export function ScanGrid({ scans }: { scans: PublicScan[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return scans;
    return scans.filter((s) => s.host.toLowerCase().includes(needle));
  }, [q, scans]);

  return (
    <>
      <div style={{ position: "relative", maxWidth: 420, margin: "0 0 22px" }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search scans by domain…"
          aria-label="Search scans by domain"
          style={{
            width: "100%",
            height: 44,
            padding: "0 16px",
            fontFamily: PJ,
            fontSize: 14.5,
            color: "var(--c-ink)",
            background: "var(--c-surface)",
            border: "1px solid var(--c-line)",
            borderRadius: 12,
            outline: "none",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontFamily: PJ, fontSize: 15, color: "var(--c-muted)", margin: "8px 0 40px" }}>
          {q.trim() ? <>No scans match &ldquo;{q.trim()}&rdquo;.</> : <>No public scans yet.</>}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/scan/${s.slug}`}
              style={{ display: "block", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 22px 20px", textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  {s.logoUrl && (
                    // Favicon of the scanned domain. Plain <img>: it's a tiny
                    // external favicon, not worth next/image domain config.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logoUrl}
                      alt=""
                      width={22}
                      height={22}
                      style={{ borderRadius: 6, flexShrink: 0, background: "var(--c-fill)" }}
                    />
                  )}
                  <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.host}
                  </span>
                </span>
                {s.score != null && (
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: scoreColor(s.score), lineHeight: 1, flexShrink: 0 }}>
                    {s.score}
                    <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/100</span>
                  </span>
                )}
              </div>
              <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "12px 0 8px" }}>
                Discoverability scan: {s.host}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--c-muted)", margin: 0, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {s.blurb ?? `A discoverability scan of ${s.host} — the score, the positioning gap, and the fixes that move it.`}
              </p>
              <span style={{ display: "inline-block", marginTop: 14, fontFamily: PJ, fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>
                View the scan →
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
