/**
 * ScanHero — the single shared hero used by BOTH the landing ("/") and /scan, so
 * the "analyze my site" experience is identical everywhere. Split layout at
 * >=1000px: copy column (eyebrow, two-line headline with the highlighted italic
 * "You aren't." punch, subhead, ScanInput pill, meta line) on the left, the
 * browser-framed proof card on the right; below the breakpoint everything
 * stacks centered as before. The proof card is a slice of the real paid
 * dashboard — gauge + band chip, you-vs-rival bars, the next best action, and
 * the search-gap rows rivals win. Optional `showScrollCue` (landing only)
 * renders a floating "See how it works" chevron anchored to #story.
 * Static demo data (bloom.io), lightweight inline SVG/HTML + one scoped
 * <style> block only (no intel-kit import — bundle budget).
 */

import { ScanInput } from "@/app/(marketing)/scan-input";

const SG = "var(--font-display)", JM = "var(--font-mono)";

// Demo proof-card gauge: 280° track + a 47/100 fill (band: "hard to find").
const CX = 80, CY = 80, R = 62, START = 130, SWEEP = 280;
const pt = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
};
const arc = (frac: number) => {
  const end = START + SWEEP * frac;
  const large = SWEEP * frac > 180 ? 1 : 0;
  return `M ${pt(START)} A ${R} ${R} 0 ${large} 1 ${pt(end)}`;
};

// Demo data — mirrors the bloom.io fixture scan the paid dashboard renders.
const RIVAL_BARS = [
  { label: "You", value: 47, color: "var(--c-band-hard)" },
  { label: "Top rival", value: 81, color: "var(--c-band-high)" },
] as const;

const GAP_ROWS = [
  { q: "habit tracker vs [rival]", vol: "2,400/mo", you: "Not ranking", ranked: false },
  { q: "best habit tracker 2026", vol: "8,100/mo", you: "#42", ranked: true },
  { q: "free habit tracker template", vol: "3,300/mo", you: "Not ranking", ranked: false },
] as const;

const chip = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  fontFamily: JM,
  fontSize: 11,
  fontWeight: 700,
  color,
  background: `color-mix(in oklab, ${color} 11%, transparent)`,
  borderRadius: 7,
  padding: "3px 9px",
  whiteSpace: "nowrap",
});

// Responsive split + scroll-cue float, scoped to this component. Default
// (narrow) is the centered stack; >=1000px flips to the two-column row with
// left-aligned copy. The chevron float only runs when motion is allowed.
const HERO_CSS = `
.rkh-grid{display:flex;flex-direction:column;align-items:center;gap:44px}
.rkh-copy{display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;max-width:720px;min-width:0}
.rkh-h1{font-size:clamp(1.4rem,6vw,44px)}
.rkh-input{width:100%;max-width:540px}
.rkh-card{width:100%;max-width:800px;min-width:0}
@media (min-width:1000px){
  .rkh-grid{flex-direction:row;align-items:center;gap:48px}
  .rkh-copy{flex:0 1 46%;align-items:flex-start;text-align:left;max-width:none}
  .rkh-h1{font-size:clamp(1.7rem,3vw,36px)}
  .rkh-input{max-width:520px}
  .rkh-card{flex:1 1 54%;max-width:none}
}
@media (prefers-reduced-motion: no-preference){
  @keyframes rkh-float{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
  .rkh-cue svg{animation:rkh-float 2s var(--ease-in-out) infinite}
}
`;

export function ScanHero({ showScrollCue = false }: { showScrollCue?: boolean }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242,238,255,0) 62%), var(--c-bg)" }}>
      <style>{HERO_CSS}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 56px" }}>
        <div className="rkh-grid">
          {/* Copy column — eyebrow, stacked headline, subhead, input, meta */}
          <div className="rkh-copy">
            {/* Short enough to stay on ONE line in the 46% column — a wrapped
                pill ("…evidence." dangling) reads broken. */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JM, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid #E7E0FB", borderRadius: 999, padding: "7px 15px", whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-action)", flexShrink: 0 }} />
              Every claim grounded in your live page.
            </span>

            {/* Fixed two-line lockup at EVERY width — one consistent size, each
                line held on one row (nowrap). "You aren't." is highlighted inline
                on line 2 in a solid marker from the CENTRAL palette (color-mix on
                var(--c-action) onto the surface — no new colour). ShipFast idiom. */}
            <h1 className="rkh-h1" style={{ fontFamily: SG, fontWeight: 700, lineHeight: 1.14, letterSpacing: "-0.035em", margin: "22px 0 0" } as React.CSSProperties}>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>Your competitors are being</span>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>
                found.{" "}
                <span style={{ display: "inline-block", fontStyle: "italic", color: "var(--c-ink)", background: "color-mix(in oklab, var(--c-action) 20%, var(--c-surface))", padding: "0.02em 0.22em", borderRadius: "0.14em" }}>You aren&apos;t.</span>
              </span>
            </h1>

            <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--c-muted)", maxWidth: 620, margin: "18px 0 0", textWrap: "pretty" } as React.CSSProperties}>
              Paste your URL. In under a minute ReachKit reads your live page the way a buyer&apos;s search does — then shows you the searches your rivals win, the score that measures the gap, and the ranked fixes that close it.
            </p>

            <div className="rkh-input" style={{ margin: "26px 0 0" }}>
              <ScanInput />
            </div>

            <p style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)", margin: "14px 0 0" }}>
              Under a minute · No login for your first scan · Try: bloom.io
            </p>
          </div>

          {/* Proof card — browser-framed slice of the paid dashboard (demo data) */}
          <div className="rkh-card" style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -28px rgba(40,33,84,0.22)", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--c-line2)", background: "var(--c-bg2)" }}>
              <span style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FF5F57" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FEBC2E" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28C840" }} />
              </span>
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", background: "var(--c-fill)", borderRadius: 7, padding: "5px 12px" }}>app.reachkit.io/scan/bloom.io</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: "24px 26px" }}>
              {/* Score gauge + band chip + you-vs-rival bars */}
              <div style={{ flex: "0 1 216px", minWidth: 196, textAlign: "center" }}>
                <svg width="160" height="160" viewBox="0 0 160 160" style={{ display: "block", margin: "0 auto" }} aria-hidden="true">
                  <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="12" strokeLinecap="round" />
                  <path d={arc(0.47)} fill="none" stroke="var(--c-band-hard)" strokeWidth="12" strokeLinecap="round" />
                  <text x="80" y="82" textAnchor="middle" style={{ font: `700 34px ${JM}, monospace`, fill: "var(--c-ink)" }}>47</text>
                  <text x="80" y="99" textAnchor="middle" style={{ font: `600 10px ${JM}, monospace`, fill: "var(--c-faint)" }}>/ 100</text>
                </svg>
                <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginTop: 2 }}>Discoverability Score</div>
                <span style={{ ...chip("var(--c-band-hard)"), fontFamily: SG, fontSize: 12, padding: "4px 11px", marginTop: 8 }}>Hard to find</span>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line2)", display: "flex", flexDirection: "column", gap: 9, textAlign: "left" }}>
                  {RIVAL_BARS.map((b) => (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 62, fontSize: 12, fontWeight: 600, color: "var(--c-ink)" }}>{b.label}</span>
                      <span style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--c-fill)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${b.value}%`, borderRadius: 4, background: b.color }} />
                      </span>
                      <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: b.color }}>{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next best action + the search-gap rows rivals win */}
              <div style={{ flex: "1 1 240px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)" }}>NEXT BEST ACTION</div>
                  <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15.5, color: "var(--c-ink)", margin: "7px 0 5px" }}>
                    Publish 3 &ldquo;bloom vs [rival]&rdquo; comparison pages
                  </div>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "0 0 10px" }}>
                    Buyers comparing habit trackers run these head-to-head searches today — and land on your rivals&apos; pages, not yours.
                  </p>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ ...chip("var(--c-action)"), background: "var(--c-soft)" }}>Content</span>
                    <span style={chip("var(--c-band-findable)")}>+6 pts est.</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 2px 8px" }}>
                    <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-faint)" }}>SEARCH GAP</span>
                    <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>queries rivals rank for — you don&apos;t</span>
                  </div>
                  <div style={{ border: "1px solid var(--c-line2)", borderRadius: 12, overflow: "hidden" }}>
                    {GAP_ROWS.map((r, i) => (
                      <div key={r.q} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)" }}>
                        <span style={{ flex: 1, fontFamily: JM, fontSize: 12.5, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.q}</span>
                        <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-muted)" }}>{r.vol}</span>
                        <span style={{ ...chip(r.ranked ? "var(--c-muted)" : "var(--c-band-invisible)"), width: 84, justifyContent: "center" }}>{r.you}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll enticement (landing only) — anchors to the first story section */}
        {showScrollCue && (
          <a
            href="#story"
            className="rkh-cue"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: "fit-content", margin: "40px auto 0", fontFamily: JM, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", color: "var(--c-faint)", textDecoration: "none" }}
          >
            See how it works
            <svg width="16" height="9" viewBox="0 0 16 9" fill="none" aria-hidden="true">
              <path d="M1 1l7 6 7-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>
    </section>
  );
}
