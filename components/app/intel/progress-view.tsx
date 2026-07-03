/**
 * ProgressView — the "Progress" tab: a large annotated Discoverability Score
 * trend (area + line + verified-fix dots, in the same idiom as the dashboard
 * hero's small ScoreTrend but bigger) plus a "What changed" events feed.
 *
 * SERVER component (no "use client") — presentational, all data arrives as
 * props from the page. Only imports non-function exports (`Card`, `Badge`)
 * from the "use client" kit — no kit *functions* (like `bandFor`) are called
 * here, so this stays safe to render on the server (per the intel RSC rule:
 * server code that needs band logic imports `bandFor` from the server-safe
 * `@/components/app/intel/bands` module instead).
 */
import Link from "next/link";
import { Card, Badge } from "@/components/app/intel/kit";
import { SCORE_BANDS } from "@/lib/scan/score-bands";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";
import type { SignalChange } from "@/lib/scan/signal-diff";

const JM = "var(--font-mono)";

export interface ProgressEvent {
  label: string;
  date: string;
  delta?: number;
  /** When set, "What changed" renders this row as a plan deep-link. */
  href?: string;
}

export interface ProgressViewProps {
  history: ScoreHistoryPoint[];
  markers: HistoryMarker[];
  events?: ProgressEvent[];
  /** Signal-level diff between the two most recent completed scans — renders a "Why it moved" panel when non-empty. */
  signalChanges?: SignalChange[];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ProgressView({ history, markers, events = [], signalChanges = [] }: ProgressViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="Discoverability over time" info="Your Discoverability Score at each scan. Dots mark a verified fix that moved the score.">
        <ScoreTrendLarge history={history} markers={markers} />
      </Card>

      {signalChanges.length > 0 && (
        <Card title="Why it moved" info="Signal-level changes between your two most recent scans — the concrete reasons your score shifted.">
          <WhyItMoved changes={signalChanges} />
        </Card>
      )}

      <Card title="What changed">
        <ChangedList events={events} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Why it moved — per-signal state transitions + contribution deltas between
// the two most recent completed scans (lib/scan/signal-diff.ts).
// ---------------------------------------------------------------------------
const SIGNAL_STATE_COLOR: Record<string, string> = {
  pass: "var(--c-band-findable)",
  warn: "var(--c-band-fair)",
  fail: "var(--c-band-invisible)",
  unmeasured: "var(--c-faint)",
};

function WhyItMoved({ changes }: { changes: SignalChange[] }) {
  const rows = changes.slice(0, 8);
  return (
    <div>
      {rows.map((c, i) => (
        <div
          key={c.key}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--c-line2)" : "none" }}
        >
          <Badge tone="neutral" style={{ flexShrink: 0, textTransform: "capitalize" }}>{c.pillar}</Badge>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.label}
          </span>
          <span style={{ fontFamily: JM, fontSize: 12, flexShrink: 0 }}>
            <span style={{ color: SIGNAL_STATE_COLOR[c.fromState] ?? "var(--c-faint)" }}>{c.fromState}</span>
            {" → "}
            <span style={{ color: SIGNAL_STATE_COLOR[c.toState] ?? "var(--c-faint)" }}>{c.toState}</span>
          </span>
          <span
            style={{
              fontFamily: JM,
              fontSize: 12.5,
              fontWeight: 700,
              width: 68,
              textAlign: "right",
              flexShrink: 0,
              color: c.contributionDelta > 0 ? "var(--c-band-high)" : c.contributionDelta < 0 ? "var(--c-band-invisible)" : "var(--c-faint)",
            }}
          >
            {c.contributionDelta > 0 ? "+" : ""}
            {c.contributionDelta.toFixed(1)} pts
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discoverability over time — a bigger inline SVG area + line + verified-fix
// dots, reusing the dashboard-hero ScoreTrend approach at a larger scale.
// ---------------------------------------------------------------------------
function ScoreTrendLarge({ history, markers }: { history: ScoreHistoryPoint[]; markers: HistoryMarker[] }) {
  if (history.length === 0) {
    return <Empty>Your score history starts after your first scan.</Empty>;
  }

  const W = 820, H = 240, padL = 8, padR = 8, padT = 16, padB = 14;
  const n = history.length;
  const x = (i: number) => (n === 1 ? W / 2 : padL + (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - padT - padB);

  const pts = history.map((p, i) => ({ x: x(i), y: y(p.total), total: p.total }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${H - padB} L${pts[0]!.x.toFixed(1)},${H - padB} Z`;

  // Pillar overlay: thin content/outreach/SEO lines under the main total line,
  // drawn only when at least two points carry a breakdown. Points missing a
  // breakdown are skipped — the line connects the nearest available points.
  const pillarKeys = ["content", "outreach", "seo"] as const;
  const pillarPointCount = history.filter((p) => p.breakdown != null).length;
  const showPillars = pillarPointCount >= 2;
  const pillarLine = (key: (typeof pillarKeys)[number]): string =>
    history
      // Skip points whose breakdown value for this pillar isn't a finite
      // number (guards malformed historical jsonb, e.g. a null/NaN slipped
      // in from an older snapshot shape) — a NaN coordinate here would emit
      // an invalid SVG path segment ("L NaN,NaN") that breaks the whole line.
      .map((p, i) => (p.breakdown && Number.isFinite(p.breakdown[key]) ? { x: x(i), y: y(p.breakdown[key]) } : null))
      .filter((d): d is { x: number; y: number } => d !== null)
      .map((d, i) => `${i ? "L" : "M"}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
      .join(" ");
  const pillars: { key: (typeof pillarKeys)[number]; label: string; color: string }[] = [
    { key: "content", label: "Content", color: "var(--c-band-findable)" },
    { key: "outreach", label: "Outreach", color: "var(--c-action)" },
    { key: "seo", label: "SEO", color: "var(--c-band-hard)" },
  ];

  // Band zones (invisible → highly discoverable), derived from the canonical
  // score-bands scale (lib/scan/score-bands.ts) so the chart's shading always
  // agrees with the gauge/report bands. Rendered as very low-opacity fills —
  // the score line stays dominant — with a faint dashed line at each boundary.
  const zones = SCORE_BANDS.map((b, i) => ({
    from: b.min,
    to: i === SCORE_BANDS.length - 1 ? 100 : SCORE_BANDS[i + 1]!.min,
    color: b.color,
  }));
  const boundaries = [0, ...SCORE_BANDS.slice(1).map((b) => b.min), 100];

  // Map each verified-fix marker onto the point whose snapshot it triggered
  // (same takenAt), so the dot lands on the line at the bump it caused.
  const markerDots = markers
    .map((m) => {
      const idx = history.findIndex((p) => p.takenAt === m.takenAt);
      return idx >= 0 ? { x: x(idx), y: y(history[idx]!.total), label: m.label, takenAt: m.takenAt, total: history[idx]!.total } : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const first = history[0]!;
  const last = history[history.length - 1]!;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Discoverability Score over time" style={{ display: "block" }}>
        <defs>
          <linearGradient id="rkProgressHist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-action)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--c-action)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {zones.map((z) => (
          <rect key={z.from} x={padL} y={y(z.to)} width={W - padL - padR} height={y(z.from) - y(z.to)} fill={z.color} opacity={0.07} />
        ))}
        {boundaries.map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--c-line)" strokeWidth={0.6} strokeDasharray={g === 0 || g === 100 ? undefined : "3 3"} />
        ))}
        <path d={area} fill="url(#rkProgressHist)" />
        {showPillars &&
          pillars.map((p) => (
            <path
              key={p.key}
              d={pillarLine(p.key)}
              fill="none"
              stroke={p.color}
              strokeWidth={1.5}
              strokeOpacity={0.55}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        <path d={line} fill="none" stroke="var(--c-action)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--c-action)" />)}
        {markerDots.map((d, i) => <circle key={`m${i}`} cx={d.x} cy={d.y} r={5} fill="var(--c-action)" stroke="var(--c-surface)" strokeWidth={2.5} />)}
      </svg>

      {showPillars && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {pillars.map((p) => (
            <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--c-faint)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "var(--radius-full)", background: p.color, flexShrink: 0 }} />
              {p.label}
            </span>
          ))}
        </div>
      )}

      {history.length === 1 ? (
        <p style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "var(--c-faint)" }}>Baseline established — weekly scans build your trend line.</p>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>
          <span>{fmtDate(first.takenAt)} · {first.total}</span>
          <span>dots = a fix shipped</span>
          <span>{fmtDate(last.takenAt)} · {last.total}</span>
        </div>
      )}

      {markerDots.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {markerDots.map((d, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: JM, fontSize: 11, color: "var(--c-muted)", background: "var(--c-fill)", border: "1px solid var(--c-line)", padding: "5px 11px", borderRadius: "var(--radius-full)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "var(--radius-full)", background: "var(--c-action)" }} />
              {fmtDate(d.takenAt)} · {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What changed — events feed (verified fixes + market signals)
// ---------------------------------------------------------------------------
function ChangedList({ events }: { events: ProgressEvent[] }) {
  if (events.length === 0) {
    return <Empty>Nothing to show yet — ship and verify a plan item to start your changelog.</Empty>;
  }
  return (
    <div>
      {events.map((e, i) => {
        const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < events.length - 1 ? "1px solid var(--c-line2)" : "none" };
        const row = (
          <>
            <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)", width: 72, flexShrink: 0 }}>{fmtDate(e.date)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--c-ink)" }}>{e.label}</span>
            {typeof e.delta === "number" && e.delta !== 0 && (
              <Badge tone={e.delta > 0 ? "green" : "red"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</Badge>
            )}
            {e.href && <span style={{ fontSize: 13, color: "var(--c-faint)", flexShrink: 0 }}>&rarr;</span>}
          </>
        );
        return e.href ? (
          <Link key={i} href={e.href} style={{ ...rowStyle, textDecoration: "none" }}>
            {row}
          </Link>
        ) : (
          <div key={i} style={rowStyle}>
            {row}
          </div>
        );
      })}
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
