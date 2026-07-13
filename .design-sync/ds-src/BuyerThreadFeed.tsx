/* @mirrors components/app/intel/buyer-thread-feed.tsx */
import * as React from "react";

/**
 * BuyerThreadFeed — the complete, filterable, keyboard-accessible feed of
 * buyer threads beneath IntentRecencyMap's dot plot: a surface chip + title
 * (a real focusable button, opening the EvidenceDrawer live) + intent badge
 * + (relative date, when available) + (engagement `▲score · N comments`,
 * when available) — never a fabricated placeholder for either. Ranked by
 * buyer intent (descending), NOT by date: thread dates are unavailable for
 * Reddit-scoped demand (Reddit 403s server-side; SERP has no timestamps),
 * so several sample rows below intentionally omit `rel` to show the honest,
 * date-absent state. Filter chips (All / 🔥 high-intent) drive a live
 * "N shown" count. The live component opens `useEvidenceDrawer()` on row
 * click; this mirror has no Provider in the sandbox, so its sample rows
 * render as plain static buttons (no-op onClick) with the same visual
 * language and a fixed sample dataset, matching the self-contained-mirror
 * convention used by `IntentRecencyMap`/`EvidenceDrawer`.
 */
type SampleThread = {
  surface: string;
  title: string;
  intent?: number;
  activity?: { score: number; comments: number } | null;
  rel?: string;
};

const PALETTE = ["#6E56F7", "#1f9d5b", "#e0731c", "#3b6fe0", "#c98a12", "#e5484d"];
const COLOUR_FOR: Record<string, string> = { "r/SaaS": PALETTE[0], "r/startups": PALETTE[1], "r/Entrepreneur": PALETTE[2], "r/marketing": PALETTE[3] };

// Ranked by intent, descending — matching the live sort. `rel` is omitted
// on most rows (Reddit-scoped threads have no publishable date); the one
// dated row shows the conditional-render path still works when a date IS
// available (e.g. a SERP-sourced surface).
const SAMPLE: SampleThread[] = [
  { surface: "r/marketing", title: "What tools do you use to see WHERE buyers are discussing your category?", intent: 0.91, activity: { score: 67, comments: 22 } },
  { surface: "r/SaaS", title: "Anyone found a good alternative for tracking backlinks without the Ahrefs price tag?", intent: 0.86, rel: "2d ago", activity: { score: 41, comments: 18 } },
  { surface: "r/startups", title: "How do you actually get your first 100 customers to find you organically?", intent: 0.72, activity: { score: 12, comments: 4 } },
  { surface: "r/Entrepreneur", title: "SEO feels like a black box — is it even worth it pre-revenue?", intent: 0.45, activity: null },
  { surface: "r/SaaS", title: "Discoverability > design for early-stage SaaS?", intent: 0.3, activity: null },
];

type Filter = "all" | "high-intent";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high-intent", label: "🔥 High intent" },
];

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);

export function BuyerThreadFeed() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const filtered = SAMPLE.filter((t) => {
    if (filter === "high-intent") return typeof t.intent === "number" && t.intent >= 0.8;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, padding: "5px 12px",
                  borderRadius: "var(--radius-full)",
                  border: active ? "1px solid var(--c-action)" : "1px solid var(--c-line)",
                  background: active ? "var(--c-soft)" : "var(--c-surface)",
                  color: active ? "var(--c-action)" : "var(--c-muted)",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)", flexShrink: 0 }}>{filtered.length} shown · ranked by buyer intent</span>
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2, maxHeight: 420, overflowY: "auto" }}>
        {filtered.map((t, i) => {
          const high = typeof t.intent === "number" && t.intent >= 0.8;
          return (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--c-line)" }}>
              <span
                title={t.surface}
                style={{
                  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
                  color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: "var(--radius-full)",
                  maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLOUR_FOR[t.surface] ?? PALETTE[5], flexShrink: 0 }} />
                {t.surface}
              </span>

              <button
                type="button"
                onClick={() => {}}
                style={{
                  flex: "1 1 auto", minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0,
                  font: "inherit", fontSize: 13, fontWeight: 500, color: "var(--c-ink)", cursor: "pointer",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {t.title}
              </button>

              {typeof t.intent === "number" && (
                <span
                  style={{
                    flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-sans)",
                    fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)", lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    background: high ? "var(--c-tint-red)" : "var(--c-fill)",
                    color: high ? "#e5484d" : "var(--c-muted)",
                  }}
                >
                  {high ? "🔥 " : ""}intent {t.intent.toFixed(2)}
                </span>
              )}

              {t.rel && (
                <span style={{ flexShrink: 0, fontSize: 11, color: "var(--c-faint)" }}>{t.rel}</span>
              )}

              {t.activity != null && (
                <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>
                  ▲{fmt(t.activity.score)} · {fmt(t.activity.comments)}
                </span>
              )}

              <a href="#" onClick={(e) => e.preventDefault()} style={{ flexShrink: 0, fontSize: 11, color: "var(--c-action)", textDecoration: "none" }}>
                open
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
