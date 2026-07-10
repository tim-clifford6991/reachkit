/* @mirrors components/app/intel/competitors-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Badge, bandFor } from "./IntelKit";

/**
 * CompetitorsScreen — the `/app/audience/competitors` page: a left "Competitors"
 * rail (pick one to inspect, pillar-health dots, you·baseline) beside the orange
 * edge panel for the selected rival (stat strip, top referrers, referrers to
 * pursue, top pages, top keywords, "their edge → your move"). Composes the shared
 * IntelKit. Mirrors the live competitors-view.
 */
export interface CompetitorsScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const dot = (v: number) => bandFor(v).color;

const ROWS = [
  { domain: "nudgi.ai", score: 47, seo: 54, content: 40, outreach: 29, you: true },
  { domain: "otter.ai", score: 67, seo: 70, content: 62, outreach: 66, sel: true },
  { domain: "fireflies.ai", score: 78, seo: 80, content: 74, outreach: 72 },
  { domain: "fathom.video", score: 86, seo: 88, content: 82, outreach: 84 },
  { domain: "grain.com", score: 61, seo: 58, content: 60, outreach: 55 },
];
const STATS = [["Est. visits / mo", "412k"], ["Referring domains", "1,240"], ["Organic keywords", "18.6k"], ["Branded search", "40k/mo"], ["Top pages", "320"]];
const REFERRERS = [
  { host: "producthunt.com", cat: "community", dr: "91", target: "/launch" },
  { host: "g2.com", cat: "directory", dr: "94", target: "/otter-ai" },
  { host: "techcrunch.com", cat: "press", dr: "93", target: "/otter-raises" },
];

function PillDot({ v }: { v: number }) { return <span title="pillar health" style={{ width: 8, height: 8, borderRadius: 999, background: dot(v) }} />; }

export function CompetitorsScreen() {
  return (
    <AppShell active="audComp" headerTitle="Competitors" headerSub="How you and your rivals get found — channels, scores, and the gaps." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* Left rail */}
        <div style={{ flex: "1 1 320px", minWidth: 300 }}>
          <Card title="Competitors" info="Pick a rival to see what powers their referral engine — and the move that answers it.">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: "var(--c-muted)", fontWeight: 600 }}>Pick one to inspect</span>
              <span style={{ display: "flex", gap: 10, fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}><span>SEO</span><span>Content</span><span>Outreach</span></span>
            </div>
            <div style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", marginBottom: 10 }}>dot color = pillar health</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ROWS.map((r) => (
                <div key={r.domain} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, background: r.sel ? "var(--c-soft)" : r.you ? "var(--c-bg2)" : "transparent", border: r.sel ? "1.5px solid var(--c-action)" : "1.5px solid transparent" }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)" }}>{r.domain}{r.you && <Badge tone="violet" style={{ marginLeft: 8 }}>you · baseline</Badge>}</span>
                  <span style={{ display: "flex", gap: 5 }}><PillDot v={r.seo} /><PillDot v={r.content} /><PillDot v={r.outreach} /></span>
                  <span style={{ width: 26, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 13, color: bandFor(r.score).color }}>{r.score}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        {/* Edge panel */}
        <div style={{ flex: "1 1 420px", minWidth: 320, background: "var(--c-tint-orange)", border: "1px solid var(--c-tint-orange-line)", borderRadius: "var(--radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontFamily: JM, fontSize: 13, fontWeight: 700 }}>otter.ai</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            {STATS.map(([l, v]) => (
              <div key={l}><div style={{ fontFamily: JM, fontSize: 10.5, textTransform: "uppercase", color: "var(--c-faint)" }}>{l}</div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 17, color: "var(--c-ink)" }}>{v}</div></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--c-ink)", marginBottom: 4 }}>Top referrers</div>
            <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-muted)", marginBottom: 10 }}>Examined 1,240 referring domains · 62% quality · community 3 · directory 2 · press 4</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REFERRERS.map((r) => (
                <div key={r.host} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
                  <span style={{ color: "var(--c-action)", fontWeight: 600 }}>{r.host} ↗</span>
                  <Badge tone="neutral">{r.cat}</Badge>
                  <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>DR {r.dr}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--c-band-findable)", background: "var(--c-tint-green)", borderRadius: 5, padding: "1px 6px" }}>dofollow</span>
                  <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>→ {r.target}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Referrers to pursue · they have, you don&apos;t (2)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["producthunt.com", "g2.com"].map((h) => <span key={h} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 999, padding: "5px 11px" }}>{h} <span style={{ color: "var(--c-action)", fontWeight: 600 }}>＋ add</span></span>)}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14 }}>
            <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--c-band-hard)", marginBottom: 6 }}>Their edge → your move</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--c-ink)", margin: 0 }}>Ranks #3 for &ldquo;ai meeting notes&rdquo; (12,000/mo) — a keyword you don&apos;t rank for at all. <a href="/app/plan" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>Counter: target &ldquo;ai meeting notes&rdquo; — in your plan</a></p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
