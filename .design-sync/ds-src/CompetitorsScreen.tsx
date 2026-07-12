/* @mirrors components/app/intel/competitors-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Badge } from "./IntelKit";
import { CompetitorGapMap } from "./CompetitorGapMap";
import { ReferrerRow } from "./ReferrerRow";
import { CompetitorEdgePanel } from "./CompetitorEdgePanel";

/**
 * CompetitorsScreen — the `/app/audience/competitors` page, REBUILT (no more
 * left rail): the gap-map matrix sits on top and doubles as the selector
 * (click a column to focus); a full-width detail panel below shows the
 * selected entity's stat strip → referrer table → "referrers to pursue" →
 * top pages/keywords → "their edge → your move". Composes CompetitorGapMap,
 * ReferrerRow and CompetitorEdgePanel — the same three components the live
 * page renders (dynamically imported there for bundle-budget reasons).
 */
export interface CompetitorsScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";

const ENTITIES = [
  { domain: "nudgi.ai", isSubject: true },
  { domain: "fellow.ai" },
  { domain: "read.ai" },
  { domain: "zocks.io" },
];

const CHANNEL_STRENGTH: Record<string, Record<string, string>> = {
  "nudgi.ai": { reviews: "lo", directories: "absent", community: "med", media: "absent", partners: "lo" },
  "fellow.ai": { reviews: "hi", directories: "hi", community: "hi", media: "med", partners: "hi" },
  "read.ai": { reviews: "hi", directories: "med", community: "med", media: "hi", partners: "med" },
  "zocks.io": { reviews: "med", directories: "hi", community: "lo", media: "med", partners: "lo" },
};

const STATS = [
  ["Est. visits / mo", "184k"],
  ["Referring domains", "960"],
  ["Organic keywords", "12.4k"],
  ["Branded search", "22k/mo"],
  ["Top pages", "210"],
];

const REFERRERS = [
  { host: "g2.com", category: "software_directory", url: "https://g2.com/products/fellow", authority: 94, dofollow: true, etv: 120000, relevance: "core" as const },
  { host: "producthunt.com", category: "community", url: "https://producthunt.com/posts/fellow", authority: 91, dofollow: true, etv: 118000, relevance: "core" as const },
  { host: "capterra.com", category: "software_directory", url: "https://capterra.com/p/fellow", authority: 88, dofollow: false, etv: 54000, relevance: "low" as const },
];

const PURSUE = [
  { host: "g2.com", category: "software_directory", dr: 94 },
  { host: "producthunt.com", category: "community", dr: 91 },
];

const PAGES = [
  { title: "AI meeting notes for remote teams", cluster: "meeting-notes", etv: 14200 },
  { title: "Fellow vs Otter.ai", cluster: "comparison", etv: 9100 },
  { title: "1:1 templates", cluster: "templates", etv: 6400 },
];

const KEYWORDS = [
  { keyword: "ai meeting notes", note: "#3", volume: 12000 },
  { keyword: "meeting action items tool", note: "#5", volume: 4400 },
  { keyword: "1:1 meeting template", note: "#2", volume: 3100 },
];

function StatStrip() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
      {STATS.map(([label, value]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 9.5, fontFamily: JM, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", fontFamily: JM }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

const EDGE_LABEL: React.CSSProperties = { fontFamily: JM, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-band-hard)" };

export function CompetitorsScreen() {
  return (
    <AppShell active="audComp" headerTitle="Competitors" headerSub="How you and your rivals get found — channels, scores, and the gaps." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* The matrix IS the selector — replaces the old left rail. */}
        <Card title="Competitors" info="Click a rival column to focus the detail below.">
          <CompetitorGapMap entities={ENTITIES} channelStrength={CHANNEL_STRENGTH} selected="fellow.ai" />
        </Card>

        {/* Full-width focused detail for the selected entity — no second nav rail. */}
        <div style={{ background: "var(--c-tint-orange)", border: "1px solid var(--c-tint-orange-line)", borderRadius: "var(--radius-xl)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "var(--c-ink)" }}>fellow.ai</span>

          <StatStrip />

          <Card title="Where fellow.ai gets found" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {REFERRERS.map((r) => <ReferrerRow key={r.host} r={r} maxEtv={120000} />)}
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14 }}>
            <span style={EDGE_LABEL}>Referrers to pursue · they have, you don&apos;t ({PURSUE.length})</span>
            {PURSUE.map((r) => (
              <div key={r.host} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.host}</span>
                <Badge tone="neutral">{r.category}</Badge>
                <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, color: "var(--c-faint)", flexShrink: 0 }}>DR&nbsp;{r.dr}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-muted)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)" }}>＋ add</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={EDGE_LABEL}>Top pages</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {PAGES.map((p, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-action)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)", flexShrink: 0 }}>{Intl.NumberFormat("en", { notation: "compact" }).format(p.etv)}</span>
                  </div>
                  <Badge tone="neutral" style={{ alignSelf: "flex-start" }}>{p.cluster}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={EDGE_LABEL}>Top keywords</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {KEYWORDS.map((k, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 0" }}>
                  <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 500 }}>{k.keyword} · {k.note}</span>
                  <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>{Intl.NumberFormat("en", { notation: "compact" }).format(k.volume)}/mo</span>
                </div>
              ))}
            </div>
          </div>

          <CompetitorEdgePanel
            text={`Ranks #3 for "ai meeting notes" (12,000/mo) — a keyword you don't rank for at all.`}
            moveLabel={`Counter: target "ai meeting notes" — in your plan`}
          />
        </div>
      </div>
    </AppShell>
  );
}
