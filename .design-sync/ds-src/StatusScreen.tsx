import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * StatusScreen — the public system-status page (`/status`): NavBar, an overall banner,
 * a per-service uptime list, and the footer. Mirrors the status surface.
 */
export interface StatusScreenProps {
  _unused?: never;
}

const SECTION: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "0 24px" };
const SERVICES = [
  { name: "Scan pipeline", uptime: "99.98%" },
  { name: "Dashboard & app", uptime: "99.99%" },
  { name: "Weekly refresh", uptime: "100%" },
  { name: "Billing", uptime: "99.99%" },
];

export function StatusScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <div style={{ ...SECTION, padding: "48px 24px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", margin: 0 }}>System status</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--c-tint-green)", border: "1px solid var(--c-band-findable)", borderRadius: "var(--radius-lg)", padding: "16px 20px" }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--c-band-findable)" }} />
          <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--c-ink)" }}>All systems operational</span>
        </div>
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {SERVICES.map((s, i) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--c-band-findable)" }} />
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--c-ink)", flex: 1 }}>{s.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--c-muted)" }}>{s.uptime}</span>
              <span style={{ fontSize: 12.5, color: "var(--c-band-high)", fontWeight: 600 }}>Operational</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--c-faint)" }}>Uptime over the last 90 days.</span>
      </div>
      <Footer />
    </div>
  );
}
