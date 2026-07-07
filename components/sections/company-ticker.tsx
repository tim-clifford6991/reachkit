/**
 * CompanyTicker — the "companies analyzed" trust strip under the hero. A pure-CSS
 * seamless marquee (the row is duplicated and translated -50%), edge-faded, that
 * pauses on hover and freezes under prefers-reduced-motion. Server component:
 * favicons + names, no JS. Social proof until real testimonials exist.
 */
import type { TickerCompany } from "@/lib/marketing/scanned-companies";

const JM = "var(--font-mono)", PJ = "var(--font-sans)";

export function CompanyTicker({ companies }: { companies: TickerCompany[] }) {
  if (companies.length === 0) return null;
  // Duplicate the row so the -50% translate loops with no visible seam.
  const row = [...companies, ...companies];

  return (
    <section
      aria-label="Companies analyzed by ReachKit"
      style={{ background: "var(--c-bg2, var(--c-surface))", borderTop: "1px solid var(--c-line)", borderBottom: "1px solid var(--c-line)", padding: "26px 0" }}
    >
      <style>{`
        @keyframes rk-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rk-ticker__track { animation: rk-ticker 55s linear infinite; will-change: transform; }
        .rk-ticker:hover .rk-ticker__track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .rk-ticker__track { animation: none; transform: none; } }
      `}</style>

      <p
        style={{
          fontFamily: JM, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--c-faint)", textAlign: "center", margin: "0 0 18px",
        }}
      >
        Companies we&apos;ve analyzed
      </p>

      <div
        className="rk-ticker"
        style={{
          overflow: "hidden",
          // Edge fade so chips dissolve into the page at both ends.
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
          maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        }}
      >
        <div className="rk-ticker__track" style={{ display: "flex", alignItems: "center", gap: 44, width: "max-content", paddingLeft: 44 }}>
          {row.map((c, i) => (
            <span
              key={`${c.domain}-${i}`}
              aria-hidden={i >= companies.length ? true : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.logoUrl}
                alt=""
                width={24}
                height={24}
                loading="lazy"
                style={{ borderRadius: 6, flexShrink: 0, background: "var(--c-surface)", boxShadow: "0 0 0 1px var(--c-line)" }}
              />
              <span style={{ fontFamily: PJ, fontSize: 15, fontWeight: 600, color: "var(--c-muted)", whiteSpace: "nowrap" }}>
                {c.name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
