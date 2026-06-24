/**
 * ScanHero — the single shared hero used by BOTH the landing ("/") and /scan, so
 * the "analyze my site" experience is identical everywhere: same eyebrow,
 * headline, subhead, ScanInput pill (input + violet "Analyze my site" button),
 * meta line, and proof card. 1:1 with the captured ReachKit.dc.html hero.
 */

import { ScanInput } from "@/app/(marketing)/scan-input";

const SG = "var(--font-display)", JM = "var(--font-mono)";

// Demo proof-card gauge: 280° track + a 47/100 fill (orange — "hard to find").
const CX = 90, CY = 90, R = 70, START = 130, SWEEP = 280;
const pt = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
};
const arc = (frac: number) => {
  const end = START + SWEEP * frac;
  const large = SWEEP * frac > 180 ? 1 : 0;
  return `M ${pt(START)} A ${R} ${R} 0 ${large} 1 ${pt(end)}`;
};

export function ScanHero() {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242,238,255,0) 62%), var(--c-bg)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 56px", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JM, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid #E7E0FB", borderRadius: 999, padding: "7px 15px" }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-action)" }} />
          Grounded in your live page. Every claim links to real evidence.
        </span>

        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.4rem, 5.4vw, 57px)", lineHeight: 1.04, letterSpacing: "-0.035em", margin: "22px auto 0", maxWidth: 860, textWrap: "balance" } as React.CSSProperties}>
          One number tells you how findable you are. <span style={{ color: "var(--c-action)" }}>And the 7 fixes that move it.</span>
        </h1>

        <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--c-muted)", maxWidth: 600, margin: "20px auto 0", textWrap: "pretty" } as React.CSSProperties}>
          Paste your URL. In 90 seconds ReachKit reads your live page like a customer&apos;s search does — and hands back your Discoverability Score, your positioning gap, and a ranked, verified to-do list.
        </p>

        <div style={{ maxWidth: 540, margin: "26px auto 0" }}>
          <ScanInput />
        </div>

        <p style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)", margin: "14px auto 0" }}>
          90 seconds · No login for your first scan · Try: bloom.io
        </p>

        {/* Proof card — browser-framed sample report */}
        <div style={{ maxWidth: 760, margin: "44px auto 0", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -28px rgba(40,33,84,0.22)", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--c-line2)", background: "var(--c-bg2)" }}>
            <span style={{ display: "flex", gap: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FF5F57" }} />
              <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FEBC2E" }} />
              <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28C840" }} />
            </span>
            <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", background: "var(--c-fill)", borderRadius: 7, padding: "5px 12px" }}>app.reachkit.io/report/bloom.io</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 24, padding: "26px 28px", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: "block", margin: "0 auto" }}>
                <path d={arc(1)} fill="none" stroke="#EEECF5" strokeWidth="13" strokeLinecap="round" />
                <path d={arc(0.47)} fill="none" stroke="#E0731C" strokeWidth="13" strokeLinecap="round" />
                <text x="90" y="92" textAnchor="middle" style={{ font: `700 38px ${JM}, monospace`, fill: "var(--c-ink)" }}>47</text>
                <text x="90" y="110" textAnchor="middle" style={{ font: `600 10px ${JM}, monospace`, fill: "var(--c-faint)" }}>/ 100</text>
              </svg>
              <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginTop: 4 }}>Discoverability Score</div>
              <span style={{ display: "inline-block", marginTop: 8, fontFamily: SG, fontWeight: 700, fontSize: 12, color: "#E0731C", background: "var(--c-tint-orange)", borderRadius: 7, padding: "4px 11px" }}>Hard to find</span>
            </div>
            <div>
              <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-faint)" }}>3 PILLARS</div>
              {[{ l: "Content", v: 56, c: "#E0731C" }, { l: "Outreach", v: 29, c: "#E5484D" }, { l: "SEO", v: 54, c: "#E0731C" }].map((p) => (
                <div key={p.l} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <span style={{ width: 64, fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>{p.l}</span>
                  <span style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--c-fill)", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${p.v}%`, borderRadius: 4, background: p.c }} />
                  </span>
                  <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: p.c }}>{p.v}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--c-line2)" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--c-soft)", color: "var(--c-action)", fontFamily: JM, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>1</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)" }}>Publish 3 &ldquo;vs competitor&rdquo; comparison pages</span>
                <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "#1F9D5B" }}>+6</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
