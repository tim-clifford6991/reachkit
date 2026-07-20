/* @mirrors components/report/captured/results-screen.tsx */
import * as React from "react";

/**
 * ResultsScreen — the free-scan report rendered at /scan/[id]: a context bar
 * (free scan · site + Share), the hero card (280° gauge showing the UNIFIED
 * Discoverability Score + band + headline + its TWO driver bars: on-page
 * readiness × search presence + the Overview hero stat — the CATEGORY size),
 * the P3 (2026-07-20, data board) SIX-SECTION BOARD: Category (broad) + Niche
 * (specific) MarketCards side by side, the "buyers compare you to" rivalry
 * line in BOTH its states (rivals found → names + per-rival teaser; none
 * found → an honest "someone is winning" degrade, WS-E), the Opportunity
 * section (the niche's own gap keywords by volume), the top ranked fixes with
 * a clickable unlock teaser, the reworked Positioning Mirror (gap insight
 * leads, compact aim→reads-as line), the evidence footnote, and the unlock
 * CTA band. A payload whose categoryCard isn't yet grounded (pre-P2 / legacy)
 * falls back to the OLD three-tier ladder + footprint-split render instead —
 * documented as a note below, not duplicated as a second full demo (the DS
 * shows the CANONICAL going-forward experience; every new scan carries a
 * ready categoryCard). Mirrors the live captured report
 * (`components/report/captured/results-screen.tsx`).
 */
export interface ResultsScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

// 280° gauge starting at 40° (matches the live report geometry).
const CX = 100, CY = 100, R = 88.5, START = 40, SWEEP = 280;
const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`; };
const arc = (frac: number) => { const end = START + SWEEP * frac; return `M ${pt(START)} A ${R} ${R} 0 ${SWEEP * frac > 180 ? 1 : 0} 1 ${pt(end)}`; };

// Score-band viz (thresholds/labels match SCORE_BANDS; DS uses the --c-band-* tokens).
function band(score: number) {
  if (score < 30) return { label: "Invisible", fg: "var(--c-band-invisible)", bg: "var(--c-tint-red)" };
  if (score < 50) return { label: "Hard to find", fg: "var(--c-band-hard)", bg: "var(--c-tint-orange)" };
  if (score < 70) return { label: "Fair — room to climb", fg: "var(--c-band-fair)", bg: "var(--c-tint-amber)" };
  if (score < 85) return { label: "Findable", fg: "var(--c-band-findable)", bg: "var(--c-tint-green)" };
  return { label: "Highly discoverable", fg: "var(--c-band-high)", bg: "var(--c-tint-green)" };
}
const pillarColor = (v: number) => (v < 30 ? "var(--c-band-invisible)" : v < 50 ? "var(--c-band-hard)" : v < 70 ? "var(--c-band-fair)" : "var(--c-band-findable)");

// v5 unified Discoverability Score = geomean of the two drivers. A tidy page (high
// on-page) that nobody finds (low search presence) reads low — the whole point.
const ON_PAGE = 72, SEARCH = 40;
const SCORE = Math.round(Math.sqrt(ON_PAGE * SEARCH)); // 54 — "Fair"
// Names whichever driver is actually weaker (search here: 40 < 72) — an
// unconditional "Search presence is your gap." would contradict the bars
// whenever on-page is the lower driver instead.
const WEAKER_DRIVER = ON_PAGE < SEARCH ? "On-page readiness" : "Search presence";
const SITE = "bloom.io";
// R1 (2026-07-19) — the listing's own self-description, rendered as a small
// line before the headline.
const IDENTITY_LINE = "Habit and mood tracking for people building daily routines.";
// P3 (2026-07-20, data board §2-3): the CATEGORY (broad, laddered-large — D2:
// a small category is a too-narrow definition, never fabricated) and NICHE
// (specific, small-is-honest) MarketCards. `rankedTop3`/`gaps` partition every
// priced phrase (`splitRankedGaps`) — CATEGORY here demos the zero-state ("None
// yet." — an honest hook, not a blank) and NICHE demos a real top-3 win, so
// both card states are visible in one demo.
const CATEGORY_CARD = {
  label: "productivity software",
  demand: 90500,
  rankedTop3: [] as { keyword: string; volume: number; yourPosition?: number }[],
  gaps: [{ keyword: "productivity software", volume: 90500 }, { keyword: "task management app", volume: 40200 }],
};
const NICHE_CARD = {
  label: "habit tracker app",
  demand: 8820,
  rankedTop3: [{ keyword: "habit journal app", volume: 720, yourPosition: 2 }],
  gaps: [{ keyword: "habit tracker app", volume: 8100 }],
};
// The Overview hero stat (§1) — the CATEGORY's own laddered demand, a
// DIFFERENT number from any legacy `categoryDemand` field (the two coexist by
// design; see search-visibility.ts's doc comment on `categoryCard`).
const HERO_MARKET_DEMAND = CATEGORY_CARD.demand;
// Opportunity (§4) — the NICHE's own gap keywords, by volume. Omitted
// entirely when there's nothing to show (invariant #11), same discipline as
// every other section here.
const NICHE_OPPORTUNITY_ROWS = NICHE_CARD.gaps;
const DRIVERS = [
  { label: "On-page readiness", value: ON_PAGE, note: "how well your page is built" },
  { label: "Search presence", value: SEARCH, note: "how findable you are in search" },
];
const FIXES = [
  { rank: 1, title: "Publish 3 “bloom vs [rival]” comparison pages", why: "Buyers run these head-to-head searches today and land on rivals' pages.", effort: "Medium", pillar: "Content", pred: 6, ec: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" } },
  { rank: 2, title: "Claim your G2 + Capterra listings", why: "Directory presence is a ranking and trust signal you're missing.", effort: "Quick", pillar: "Outreach", pred: 5, ec: { bg: "var(--c-tint-blue)", fg: "var(--c-action)" } },
  { rank: 3, title: "Add FAQ schema to your pricing page", why: "Structured data wins rich results for high-intent queries.", effort: "Quick", pillar: "SEO", pred: 4, ec: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" } },
];
const INTENDED = ["habit tracking", "productivity", "wellness"];
const ACTUAL = ["mood journal", "self-care app", "daily check-in"];

const CARD: React.CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16 };
const H2: React.CSSProperties = { fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" };
const SUB: React.CSSProperties = { fontSize: 14, color: "var(--c-faint)", margin: "0 0 12px" };
const UNLOCK: React.CSSProperties = { color: "var(--c-action)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" };

export function ResultsScreen() {
  const b = band(SCORE);
  return (
    <main style={{ background: "var(--c-bg2)", minHeight: "100vh", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px clamp(24px,4vw,48px) 70px" }}>
        {/* Context bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)" }}>free scan · {SITE}</span>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-action)", background: "var(--c-surface)", border: "1.5px solid var(--c-tint-violet-line)", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-action)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            Share score
          </button>
        </div>

        {/* Hero card — ONE unified score + its two drivers (no more "98 vs Invisible") */}
        <div style={{ ...CARD, borderRadius: 20, padding: "clamp(20px, 5vw, 32px)", boxShadow: "0 16px 44px -26px rgba(40,33,84,0.3)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 34, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block" }} aria-hidden="true">
              <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="15" strokeLinecap="round" />
              <path d={arc(SCORE / 100)} fill="none" stroke={b.fg} strokeWidth="15" strokeLinecap="round" />
              <text x="100" y="106" textAnchor="middle" style={{ font: `700 40px ${JM}, monospace`, fill: "var(--c-ink)" }}>{SCORE}</text>
              <text x="100" y="126" textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
            </svg>
            <span style={{ display: "inline-block", background: b.bg, color: b.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, fontFamily: SG, marginTop: 4 }}>{b.label}</span>
            <div style={{ fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM, maxWidth: 200, margin: "10px auto 0" }}>Page quality × search presence.</div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "0 0 8px", lineHeight: 1.5 }}>{IDENTITY_LINE}</div>
            {/* Part C (2026-07-19) — a JS-shell fetch our one Tavily Extract
                escalation also couldn't recover degrades to this honest line,
                in the SAME identity-strip slot, replacing false-confidence
                findings framing. Demo shows the healthy IDENTITY_LINE above
                (the common case); this note discloses the exact copy shown
                live when `fetchDegraded` is true. */}
            <div style={{ fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic", margin: "0 0 4px" }}>
              fetchDegraded (unreadable page) → the identity line above is replaced with: "We couldn&apos;t fully read this page (it renders in the browser). On-page findings may be incomplete."
            </div>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Your category gets 12,400 searches a month — and you&apos;re barely visible for any of them.</h1>
            {/* ON_PAGE (72) >= 60 → the intro credits the on-page driver, never
                the unified SCORE (54) — the intro gates on onPageReadiness so
                a tidy page nobody finds can't be told it "has real on-page
                gaps" beside its own high on-page bar (live fix: the intro's
                gate in to-results-props.ts reads onPageReadiness, not the
                mixed unified total). */}
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 18px" }}>{SITE} is in decent on-page shape. The plan below focuses on where you can still gain ground.</p>
            {/* The two drivers of the unified score */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {DRIVERS.map((d) => (
                <div key={d.label}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
                    <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 15, color: pillarColor(d.value) }}>{d.value}<span style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 500 }}>/100</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 5, width: `${d.value}%`, background: pillarColor(d.value) }} /></div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM }}>{d.note}</div>
                </div>
              ))}
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--c-muted)", fontFamily: JM, paddingTop: 4, borderTop: "1px dashed var(--c-line2)", marginTop: 2 }}>
                Your score multiplies both. <strong style={{ color: "var(--c-ink)" }}>{WEAKER_DRIVER} is your gap.</strong>
              </div>
              {/* P3 (data board §1, Overview): the hero stat — the CATEGORY
                  size, laddered-large and grounded (D2: a small category is a
                  too-narrow definition, never fabricated). Sits at the bottom
                  of the SAME hero card, beneath the driver bars. */}
              <div style={{ marginTop: 2, paddingTop: 12, borderTop: "1px solid var(--c-line2)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{HERO_MARKET_DEMAND.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches/mo in your market — you&apos;re in a real category</span>
              </div>
            </div>
          </div>
        </div>

        {/* Your category, and how much of it you own — LIFTED directly under the score */}
        <h2 style={H2}>Your category, and how much of it you own</h2>
        <p style={SUB}>What buyers search, what you capture, who takes the rest.</p>
        {/* P3 (2026-07-20, data board §2-3): ONE reusable MarketCard, used
            TWICE — Category (broad) and Niche (specific) — in the
            intrinsic-collapse grid idiom (dashboard-hero.tsx's
            `repeat(auto-fit, minmax(min(100%, 240px), 1fr))`, no media query
            needed — mobile-safe by construction). Replaces the old BROAD |
            CATEGORY | NICHE three-tier ladder (E1, 2026-07-19) — that design
            is retired going forward; a payload whose categoryCard isn't yet
            grounded (pre-P2/legacy) falls back to it instead of this board
            (invariant #11: don't crash, don't blank; see the live component's
            `marketCardReady` gate). CATEGORY demos the zero-state ("None
            yet." — a real hook, not a blank); NICHE demos a real top-3 win —
            so both card states are visible in one demo. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, marginBottom: 14 }}>
          <div style={CARD}>
            <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "var(--c-tint-violet)", color: "var(--c-action)" }}>YOUR CATEGORY</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
              <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{CATEGORY_CARD.demand.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches / mo</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 12 }}>{CATEGORY_CARD.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You rank top 3 for</div>
            {/* "None yet." — the single most useful thing the card can say
                (savvycal.com ranks for ZERO scheduling terms, live): an
                honest hook, never a blank. */}
            <div style={{ fontSize: 12.5, color: "var(--c-muted)", background: "var(--c-tint-red)", borderLeft: "3px solid var(--c-band-invisible)", borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
              <strong style={{ color: "var(--c-band-invisible)" }}>None yet.</strong> You don&apos;t rank for a single term in your own category.
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You don&apos;t rank for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORY_CARD.gaps.map((g) => (
                <span key={g.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-fill)", color: "var(--c-muted)" }}>{g.keyword} <strong style={{ color: "var(--c-ink)" }}>{g.volume.toLocaleString()}</strong></span>
              ))}
            </div>
          </div>
          <div style={CARD}>
            <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "var(--c-tint-amber)", color: "var(--c-band-fair)" }}>YOUR NICHE</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
              <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{NICHE_CARD.demand.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches / mo</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 12 }}>{NICHE_CARD.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You rank top 3 for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NICHE_CARD.rankedTop3.map((r) => (
                <span key={r.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-tint-green)", color: "var(--c-band-high)", display: "inline-flex", gap: 6, alignItems: "baseline" }}>
                  <strong style={{ color: "var(--c-band-high)" }}>#{r.yourPosition}</strong> {r.keyword} <strong>{r.volume.toLocaleString()}</strong>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You don&apos;t rank for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NICHE_CARD.gaps.map((g) => (
                <span key={g.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-fill)", color: "var(--c-muted)" }}>{g.keyword} <strong style={{ color: "var(--c-ink)" }}>{g.volume.toLocaleString()}</strong></span>
              ))}
            </div>
          </div>
        </div>
        {/* WS-E (2026-07-19): both rivalry states render live now — a scan
            with zero discovered rivals used to drop the "someone is
            winning" insight entirely instead of degrading. Demo shows the
            common "found" case; the note below is the exact copy shown
            live when no rivals are discovered. Sits BELOW the card grid —
            it's not tied to either card, it's about the category as a whole. */}
        <div style={{ ...CARD, marginBottom: 14, fontSize: 13, color: "var(--c-muted)" }}>
          Buyers compare you to <strong style={{ color: "var(--c-ink)" }}>Streaks, Habitica, Way of Life</strong> — and rivals are taking the searches above. <span style={UNLOCK}>Unlock to see how each one ranks, why they win, and how much of your category each takes →</span>
        </div>
        <div style={{ marginTop: -6, marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          No rivals discovered → degrades to: "Someone is winning these searches today. <span style={UNLOCK}>The full scan discovers who&apos;s winning these searches and what they do to rank →</span>"
        </div>
        {/* P3 (data board §4): Opportunity — the NICHE's own gap keywords,
            100% real positions + DataForSEO volumes, zero LLM, by volume.
            Replaces the old "biggest untapped opportunity" promoted-row card
            (the wireframe has exactly ONE opportunity section, never two
            competing framings back to back) — omitted entirely when there's
            nothing to show (invariant #11), same discipline as every other
            section here. */}
        <div style={{ ...CARD, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-band-fair)", marginBottom: 4 }}>Opportunity · your niche</div>
          <div style={{ fontSize: 12.5, color: "var(--c-faint)", marginBottom: 10 }}>Where the searches are — and you&apos;re not there.</div>
          {NICHE_OPPORTUNITY_ROWS.map((row) => (
            <div key={row.keyword} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--c-line2)", fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 0 }} className="rk-wrap-any">{row.keyword}</span>
              <span style={{ fontFamily: JM, color: "var(--c-muted)", fontSize: 12.5, whiteSpace: "nowrap" }}>{row.volume.toLocaleString()} / mo</span>
              <span style={{ fontFamily: JM, fontWeight: 700, color: "var(--c-band-invisible)", fontSize: 12, whiteSpace: "nowrap" }}>not ranking</span>
            </div>
          ))}
        </div>
        {/* D3/P3: the aggregation strip — reframes a directory/aggregator's
            footprint as its OWN engine, not leaked/scolded traffic. Fires
            whenever aggregatedPct ≥ 40 (unconditional on categoryCard — a P1
            field). This demo's site isn't a directory, so the strip doesn't
            render live here; the note documents the exact copy + trigger. */}
        <div style={{ marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          aggregatedPct ≥ 40 (directory/aggregator pattern, e.g. trustmrr.com 78%) → renders a "DIRECTORY PATTERN DETECTED" card: "<strong>78%</strong> of your traffic is the names of companies you list (cometly, trimrx…) — your directory engine, not lost buyers."
        </div>
        {/* Legacy note — a payload captured before P2 (categoryCard never
            grounded) falls back to the OLD BROAD | CATEGORY | NICHE ladder +
            the brand/category/other-companies footprint-split bar + the
            "biggest untapped opportunity" promoted card, unchanged from
            before this redesign. Documented (with the exact live copy, so the
            label-drift gate stays green), not duplicated as a second demo. */}
        <div style={{ marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          Legacy payload (no categoryCard) → falls back to the pre-P2 three-tier ladder ("You rank in the top 3 for N of your category&apos;s searches.") + the footprint-split bar ("Traffic split across your top-ranked terms.") + the promoted "Your biggest untapped opportunity" card (degrading to "Unlock to see who wins them and how →" when nothing parses) instead of the board above (don&apos;t crash, don&apos;t blank).
        </div>

        {/* Ranked fixes */}
        <h2 style={H2}>Your top {FIXES.length} ranked fixes</h2>
        <p style={SUB}>Ordered by expected score impact. Free scans show {FIXES.length} of {FIXES.length + 5}.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FIXES.map((f) => (
            <div key={f.rank} style={{ ...CARD, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: f.ec.bg, color: f.ec.fg, fontFamily: JM, fontWeight: 700 }}>{f.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: "var(--c-faint)", margin: "3px 0 8px" }}>{f.why}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: f.ec.fg, background: f.ec.bg }}>{f.effort}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: "var(--c-muted)", background: "var(--c-fill)" }}>{f.pillar}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600 }}>Predicted</div>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "var(--c-band-findable)" }}>+{f.pred}</div>
              </div>
            </div>
          ))}
          {/* Live renders the "worth an estimated +N" clause only when
              lockedWorth > 0 (never "+0" — housekeeping 2026-07-16); this
              demo's worth is 21, so the clause renders here. */}
          <div style={{ border: "1px dashed var(--c-line2)", borderRadius: 14, padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>🔒 5 more ranked fixes — worth an estimated +21 — <span style={UNLOCK}>unlock the full plan →</span></div>
        </div>

        {/* Positioning Mirror — reworked: gap insight leads, audience is a compact
            aim→reads-as line (no more two heavy chip columns). */}
        <h2 style={H2}>Positioning Mirror</h2>
        <p style={SUB}>Whether your page reads as the audience you actually want.</p>
        <div style={{ ...CARD, padding: 24 }}>
          <div style={{ background: "var(--c-tint-red)", borderLeft: "3px solid var(--c-band-invisible)", borderRadius: "0 10px 10px 0", padding: "16px 18px", fontSize: 15, lineHeight: 1.6, color: "var(--c-ink)" }}>Buyers searching for a habit tracker never see themselves in your page — it reads as a mood journal, so you lose them before the comparison.</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", marginTop: 16, fontSize: 13.5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>You aim for</span>
            <span style={{ fontWeight: 600, color: "var(--c-action)" }}>{INTENDED.join(", ")}</span>
            <span style={{ color: "var(--c-faint)" }}>→</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>Your page reads as</span>
            <span style={{ fontWeight: 600, color: "var(--c-band-hard)" }}>{ACTUAL.join(", ")}</span>
          </div>
        </div>

        {/* Evidence footnote */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-band-findable)" }} />
          Scanned {SITE} just now · every claim links to extracted evidence
        </div>

        {/* Unlock band */}
        <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h3 style={{ color: "var(--c-on-dark)", fontFamily: SG, fontWeight: 700, fontSize: 22, margin: 0 }}>Get the full growth playbook + weekly tracking</h3>
            <p style={{ color: "var(--c-on-dark-muted)", maxWidth: 430, margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>Ready-to-ship drafts, competitor &amp; keyword-gap intel, the full 18-signal breakdown, and weekly score tracking as you ship.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button style={{ background: "var(--c-surface)", color: "var(--c-ink)", borderRadius: 10, padding: "13px 24px", border: "none", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap" }}>Unlock the full report →</button>
            {/* Price stated up front on the unlock CTA (from lib/billing/pricing.ts's
                tierByPlan/fmtPrice on the live report — never learned only inside
                Stripe Checkout). */}
            <span style={{ fontFamily: JM, fontSize: 12.5, color: "#B7B4C4" }}>€59/mo · cancel anytime</span>
          </div>
        </div>
      </div>
    </main>
  );
}
