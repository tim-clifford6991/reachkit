/**
 * CompanyTicker — the "companies analyzed" trust strip under the hero. A pure-CSS
 * seamless marquee (the row is duplicated and translated -50%), edge-faded, that
 * pauses on hover and freezes under prefers-reduced-motion. Server component:
 * favicons + names, no JS. Social proof until real testimonials exist.
 */
import Link from "next/link";
import type { TickerCompany } from "@/lib/marketing/scanned-companies";

const JM = "var(--font-mono)", PJ = "var(--font-sans)";

export function CompanyTicker({ companies }: { companies: TickerCompany[] }) {
  if (companies.length === 0) return null;
  // Duplicate the row so the -50% translate loops with no visible seam.
  const row = [...companies, ...companies];

  return (
    <section aria-label="Companies analyzed by ReachKit" style={{ padding: "8px 0 2px" }}>
      <style>{`
        @keyframes rk-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rk-ticker__track { animation: rk-ticker 55s linear infinite; will-change: transform; }
        .rk-ticker:hover .rk-ticker__track { animation-play-state: paused; }
        .rk-ticker__chip:hover span { color: var(--c-ink); }
        .rk-ticker__chip:hover img { box-shadow: 0 0 0 1px var(--c-action); }
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
        <div className="rk-ticker__track" style={{ display: "flex", alignItems: "center", gap: 40, width: "max-content", paddingLeft: 40 }}>
          {row.map((c, i) => (
            <Link
              key={`${c.domain}-${i}`}
              href={`/scan/${c.domain}`}
              aria-hidden={i >= companies.length ? true : undefined}
              tabIndex={i >= companies.length ? -1 : undefined}
              title={`View the discoverability scan for ${c.name}`}
              className="rk-ticker__chip"
              style={{ display: "inline-flex", alignItems: "center", gap: 11, flexShrink: 0, textDecoration: "none" }}
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
