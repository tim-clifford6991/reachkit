/**
 * DashboardHero — the scan-side, server-rendered top of the Dashboard home: the
 * Discoverability Score gauge + pillar breakdown + weakest-pillar lever, and the
 * "Discoverability over time" trend. Renders instantly from cheap Supabase reads
 * (no intel gather). Presentational: all data arrives as props from the page.
 *
 * Built on the intel kit (`--c-*` idiom, no recharts) so it sits seamlessly above
 * the streamed intel blocks. The trend is a small inline SVG in the same idiom
 * rather than the report's recharts chart (which uses a different token vocab).
 */

import Link from "next/link";
import { CheckoutButton } from "@/components/app/checkout-button";
import { Card, HeroCard, Bar, Eyebrow, Badge, Gauge } from "@/components/app/intel/kit";
// bandFor comes from the server-safe bands module, NOT the "use client" kit:
// this is a server component, and calling a client-exported function during
// server render throws ("Attempted to call bandFor() from the server").
import { bandFor } from "@/components/app/intel/bands";
import type { PillarRollup } from "@/lib/scan/pillar-scores";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";
import type { ProgressEvent } from "@/lib/scan/progress-events";

const JM = "var(--font-mono)";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface DashboardHeroProps {
  score: number;
  rollup: PillarRollup;
  history: ScoreHistoryPoint[];
  markers: HistoryMarker[];
  /** Paid users get the plan link; free users get one-click Solo checkout (W6). */
  isPaid: boolean;
  /** F2 — the off-site "Market position" grade (paid deep pass). Shown beside the
   *  on-site score so a tidy landing page can't be mistaken for market strength. */
  marketPosition?: number | null;
  /** v5 — the two drivers of the unified gauge (on-page readiness × search presence),
   *  shown beneath it so a low score next to strong pillars reads as intentional. */
  onPageReadiness?: number | null;
  searchPresence?: number | null;
  /** WS4 — the merged verified-fix + market-alert changelog, newest first, for the
   *  compact "What's changed lately" recap beside the trend. */
  events?: ProgressEvent[];
}

export function DashboardHero({ score, rollup, history, markers, isPaid, marketPosition, onPageReadiness, searchPresence, events = [] }: DashboardHeroProps) {
  const band = bandFor(score);
  const assessedCount = rollup.pillars.filter((p) => p.assessed).length;
  const delta =
    history.length >= 2 ? history[history.length - 1]!.total - history[history.length - 2]!.total : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SCORE + PILLARS + LEVER */}
      <Card title="Discoverability Score" meta={band.label}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Gauge score={score} />
            <span style={{ fontSize: 10.5, fontFamily: JM, color: "var(--c-faint)", letterSpacing: "0.03em" }} title="Your unified Discoverability Score — the geometric mean of on-page readiness (your page build quality) and search presence (how findable you are in search). BOTH must be strong: a flawless page nobody finds still scores low. Identical on the free and paid scans — it never moves on upgrade. How you stack up off-site vs rivals (keyword footprint, backlinks, marketplace/community presence) is the separate Market Position grade.">DISCOVERABILITY</span>
            {/* The two drivers of the unified gauge — so a low score next to strong
                on-page pillars reads as intentional (search presence is the gap),
                not broken. Only when both halves are known (v5 web scans). */}
            {onPageReadiness != null && searchPresence != null && (
              <div style={{ display: "flex", gap: 10, fontSize: 10.5, fontFamily: JM, color: "var(--c-faint)" }}>
                <span title="How well your page is built (on-site signals).">On-page <strong style={{ color: bandFor(onPageReadiness).color }}>{onPageReadiness}</strong></span>
                <span style={{ color: "var(--c-line)" }}>·</span>
                <span title="How findable you are in search.">Search <strong style={{ color: bandFor(searchPresence).color }}>{searchPresence}</strong></span>
              </div>
            )}
            {delta !== null && (
              <span style={{ fontSize: 12, fontFamily: JM, color: delta > 0 ? "var(--c-band-high)" : delta < 0 ? "var(--c-band-invisible)" : "var(--c-faint)" }}>
                {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "no change"} since last scan
              </span>
            )}
            {/* F2 — the honest cohort-relative counterpart to the on-site score. */}
            {marketPosition != null && (() => {
              const mb = bandFor(marketPosition);
              return (
                <div id="market-position" style={{ marginTop: 8, paddingTop: 10, borderTop: "1px dashed var(--c-line)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 10.5, fontFamily: JM, color: "var(--c-faint)", letterSpacing: "0.03em" }}>MARKET POSITION vs RIVALS</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 24, color: mb.color }}>{marketPosition}</span>
                    <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ 100 · {mb.label}</span>
                  </div>
                  <span style={{ fontSize: 10.5, color: "var(--c-faint)", textAlign: "center", maxWidth: 190, lineHeight: 1.4 }}>Off-site footprint (keywords, backlinks, presence) vs your discovered competitors.</span>
                </div>
              );
            })()}
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
            {rollup.pillars.map((p) => (
              <div key={p.pillar} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 76, flexShrink: 0, fontSize: 12.5, color: "var(--c-muted)" }}>{p.label}</span>
                {p.assessed ? (
                  <>
                    <div style={{ flex: 1 }}><Bar value={p.value} color={bandFor(p.value).color} /></div>
                    <span style={{ width: 30, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 13, color: "var(--c-ink)" }}>{p.value}</span>
                  </>
                ) : p.pillar === "outreach" ? (
                  // Outreach has no on-site signal — its strength is measured OFF-SITE
                  // as Market Position (the block above, ~line 80). Point there instead
                  // of reading as broken/incomplete.
                  <a href="#market-position" style={{ flex: 1, fontSize: 12, fontStyle: "italic", color: "var(--c-action)", textDecoration: "none" }}>
                    measured off-site → Market Position
                  </a>
                ) : (
                  <span style={{ flex: 1, fontSize: 12, fontStyle: "italic", color: "var(--c-faint)" }}>not measured yet</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <LeverBanner rollup={rollup} assessedCount={assessedCount} isPaid={isPaid} />
        </div>
      </Card>

      {/* SCORE OVER TIME + RECENT CHANGES — half-width trend beside a compact
          changelog recap, both deep-linking to the full Progress page. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 20 }}>
        <Card title="Discoverability over time" info="Your Discoverability Score at each scan. Dots mark a verified fix that moved the score.">
          <ScoreTrend history={history} markers={markers} />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-line)", textAlign: "right" }}>
            <Link href="/app/progress" style={{ fontSize: 12, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
              Full history →
            </Link>
          </div>
        </Card>
        <Card title="What's changed lately">
          <RecentChangesRecap events={events} />
        </Card>
      </div>
    </div>
  );
}

/** Compact top-3 changelog recap beside the trend — the same events feed as
 *  the full Progress page (`buildProgressEvents`), just truncated. */
export function RecentChangesRecap({ events }: { events: ProgressEvent[] }) {
  if (events.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--c-faint)" }}>
        Your changelog builds as you ship &amp; verify fixes.
      </p>
    );
  }

  const top = events.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((e, i) => (
          <li key={i}>
            <Link href={e.href ?? "/app/progress"} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.label}</span>
              {e.delta != null && (
                <span style={{ flexShrink: 0, fontSize: 12, fontFamily: JM, color: e.delta > 0 ? "var(--c-band-high)" : e.delta < 0 ? "var(--c-band-invisible)" : "var(--c-faint)" }}>
                  {e.delta > 0 ? `▲ +${e.delta}` : e.delta < 0 ? `▼ ${e.delta}` : "no change"}
                </span>
              )}
              <span style={{ flexShrink: 0, fontSize: 11.5, fontFamily: JM, color: "var(--c-faint)" }}>{fmtDate(e.date)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-line)", textAlign: "right" }}>
        <Link href="/app/progress" style={{ fontSize: 12, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
          See all →
        </Link>
      </div>
    </div>
  );
}

/** The weakest-pillar callout — a violet HeroCard naming the biggest lever + CTA. */
function LeverBanner({ rollup, assessedCount, isPaid }: { rollup: PillarRollup; assessedCount: number; isPaid: boolean }) {
  const { weakest, estGain } = rollup;

  // First-scan case: only SEO is measured — the honest lever is to unlock the
  // other pillars by shipping & verifying actions, not "improve SEO".
  const firstScan = assessedCount <= 1;

  return (
    <HeroCard>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <Eyebrow color="var(--c-action)">Your biggest lever</Eyebrow>
        <div style={{ flex: "1 1 340px", minWidth: 0, fontSize: 14, color: "var(--c-ink)" }}>
          {firstScan || !weakest ? (
            <>Only <strong>SEO</strong> is measured so far — ship and verify a couple of content &amp; outreach actions to unlock the rest of your score.</>
          ) : (
            <>
              <strong>{weakest.label}</strong> is your lowest-scoring pillar at{" "}
              <span style={{ fontFamily: JM }}>{weakest.value}</span>/100.
              {estGain > 0 && (
                <> Closing that gap could add <span style={{ fontFamily: JM, color: "var(--c-action)", fontWeight: 700 }}>~+{estGain} pts</span> to your score.</>
              )}
            </>
          )}
        </div>
        {isPaid ? (
          <Link href="/app/plan" style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none", whiteSpace: "nowrap" }}>
            See your plan →
          </Link>
        ) : (
          // Free-user teaser → one-click Solo checkout (W6); billing page only
          // as the error fallback. Same visual weight as the paid link.
          <CheckoutButton plan="solo" pendingLabel="Redirecting…" style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: "var(--c-action)", background: "none", border: "none", padding: 0, whiteSpace: "nowrap" }}>
            Unlock your full plan →
          </CheckoutButton>
        )}
      </div>
    </HeroCard>
  );
}

/** Small inline SVG score-trend in the kit idiom (area + line + verified-fix dots). */
function ScoreTrend({ history, markers }: { history: ScoreHistoryPoint[]; markers: HistoryMarker[] }) {
  if (history.length === 0) {
    return <Empty>Your score history starts with your first scan.</Empty>;
  }

  const W = 640, H = 150, padL = 6, padR = 6, padT = 12, padB = 10;
  const n = history.length;
  const x = (i: number) => (n === 1 ? W / 2 : padL + (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - padT - padB);

  const pts = history.map((p, i) => ({ x: x(i), y: y(p.total), total: p.total }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${H - padB} L${pts[0]!.x.toFixed(1)},${H - padB} Z`;

  // Map each verified-fix marker onto the point whose snapshot it triggered
  // (same takenAt), so the dot lands on the line at the bump it caused.
  const markerDots = markers
    .map((m) => {
      const idx = history.findIndex((p) => p.takenAt === m.takenAt);
      return idx >= 0 ? { x: x(idx), y: y(history[idx]!.total), label: m.label, takenAt: m.takenAt } : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Discoverability Score over time" style={{ display: "block" }}>
        {[0, 50, 100].map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--c-line)" strokeWidth={0.6} strokeDasharray={g === 0 || g === 100 ? undefined : "3 3"} />
        ))}
        <path d={area} fill="var(--c-soft)" />
        <path d={line} fill="none" stroke="var(--c-action)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--c-action)" />)}
        {markerDots.map((d, i) => <circle key={`m${i}`} cx={d.x} cy={d.y} r={4.5} fill="var(--c-action)" stroke="var(--c-surface)" strokeWidth={2} />)}
      </svg>
      {history.length === 1 ? (
        <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "var(--c-faint)" }}>Baseline established — weekly scans build your trend line.</p>
      ) : markerDots.length > 0 ? (
        <ul style={{ margin: "12px 0 0", padding: "12px 0 0", borderTop: "1px solid var(--c-line)", listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {markerDots.slice(-4).map((d, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Badge tone="green">✓ fix</Badge>
              <span style={{ flex: 1, color: "var(--c-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", flexShrink: 0 }}>{fmtDate(d.takenAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--c-faint)", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-lg)" }}>
      {children}
    </div>
  );
}
