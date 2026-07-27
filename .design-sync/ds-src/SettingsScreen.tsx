/* @mirrors components/app/captured/settings-main.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Badge } from "./IntelKit";

/**
 * SettingsScreen — the `/app/settings` page: the Plan card (violet panel + manage
 * billing / upgrade), the Tracked product card (avatar + product URL form), the
 * Scoring card (version / signals / auto-scan / digest), and the Account card
 * (delete). Composes the shared IntelKit. Mirrors the live settings-main.
 */
export interface SettingsScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

const SCORING: [string, React.ReactNode][] = [
  ["Score model", "v5 · geometric mean"],
  ["On-page readiness", "8 signals"],
  ["Search presence", "live rankings"],
  ["Weekly auto-scan", <span key="a" style={{ color: "var(--c-band-findable)", fontWeight: 600 }}>On</span>],
  ["Email score digest", <span key="d" style={{ color: "var(--c-band-findable)", fontWeight: 600 }}>On</span>],
];

export function SettingsScreen() {
  return (
    <AppShell active="settings" headerTitle="Settings" headerSub="Your plan, tracked product, and account." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
        {/* Plan */}
        <Card title="Plan">
          <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-action)" }}>Solo</div>
            <div style={{ fontSize: 13.5, color: "var(--c-muted)", marginTop: 4 }}>Solo · $59/mo — 1 product · weekly re-scan · 20-keyword depth</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Manage billing</button>
              <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-on-dark)", background: "var(--c-action)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Upgrade to Growth</button>
            </div>
          </div>
        </Card>

        {/* Tracked product */}
        <Card title="Tracked product">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, var(--c-action), color-mix(in oklab, var(--c-action), white 20%))", color: "var(--c-on-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: SG }}>N</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>nudgi.ai</div><div style={{ fontSize: 12.5, color: "var(--c-faint)" }}>Web · scanned 2 days ago</div></div>
            <Badge tone="green">data fresh</Badge>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--c-line)" }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-muted)" }}>Product URL</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input readOnly defaultValue="nudgi.ai" placeholder="example.com" style={{ flex: 1, background: "var(--c-bg)", border: "1px solid var(--c-line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--c-ink)", outline: "none" }} />
              <button style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-on-dark)", background: "var(--c-action)", border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer" }}>Save</button>
            </div>
          </div>
          {/* Add another product right here (beside the per-row Remove above). */}
          <a href="/app/add" style={{ display: "inline-block", marginTop: 14, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>+ Add product</a>
        </Card>

        {/* Scoring */}
        <Card title="Scoring">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {SCORING.map(([l, v], i) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)" }}>
                <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>{l}</span>
                <span style={{ fontFamily: JM, fontSize: 13, color: "var(--c-ink)" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Account */}
        <Card title="Account">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Data export (GDPR portability) — a plain link that streams a JSON
                attachment. Mirrors the live settings-main "Export my data" row. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: 18, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--c-ink)" }}>Export my data</div>
                <div style={{ fontSize: 13.5, color: "var(--c-muted)", marginTop: 2 }}>Download everything we hold about your account as a JSON file.</div>
              </div>
              <a href="/api/app/account/export" style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 8, padding: "8px 14px", textDecoration: "none", whiteSpace: "nowrap" }}>Export my data</a>
            </div>
            {/* Danger zone — hard delete (AccountDeleteLazy in the live screen). */}
            <div style={{ background: "var(--c-tint-red)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--c-band-invisible)" }}>Delete account</div>
              <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "6px 0 12px" }}>Permanently remove your account and tracked data. We&apos;ll confirm by email.</p>
              <a href="mailto:hello@reachkit.app?subject=Delete my ReachKit account" style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--c-band-invisible)", background: "var(--c-surface)", border: "1px solid var(--c-tint-red)", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>Delete account</a>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
