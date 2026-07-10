/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * Testimonials — the landing's three founder quote cards (Mara K., Devon T.,
 * Avi R.), each with a coloured initials avatar and a name/role. Mirrors the
 * testimonial grid on the live landing (`landing-html.ts`).
 */
export interface TestimonialsProps {
  _unused?: never;
}

const CARDS = [
  { quote: "I'd been guessing for a year. ReachKit gave me a 41 and three fixes. Two weeks later I was at 58 and actually getting signups from search.", initials: "MK", name: "Mara K.", role: "founder, indie SaaS", bg: "var(--c-soft)", fg: "var(--c-action)" },
  { quote: "The verification is the whole thing. It re-checked my page and told me my schema was malformed. No other tool caught that.", initials: "DT", name: "Devon T.", role: "solo, dev tools", bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" },
  { quote: "One number my whole roadmap rallies around. I share my score card every Friday — it's become my accountability ritual.", initials: "AR", name: "Avi R.", role: "founder, fintech", bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" },
];

export function Testimonials() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {CARDS.map((c) => (
          <div key={c.initials} style={{ border: "1px solid var(--c-line)", borderRadius: 16, padding: 24, background: "var(--c-surface)" }}>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-ink)", margin: "0 0 16px" }}>&ldquo;{c.quote}&rdquo;</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{c.initials}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--c-faint)" }}>{c.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
