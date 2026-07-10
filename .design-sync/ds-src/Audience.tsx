/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * Audience — the landing's "Built for you" band: a centred heading and four
 * numbered persona cards (Indie hackers, Solo SaaS founders, Bootstrappers,
 * AI-native builders). Mirrors the personas grid on the live landing
 * (`landing-html.ts`).
 */
export interface AudienceProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const CARDS = [
  { n: "01", title: "Indie hackers", body: "Ship in public — then find out in under a minute whether anyone can actually find it." },
  { n: "02", title: "Solo SaaS founders", body: "One score, one short list. No agency, no 200-metric dashboard to babysit." },
  { n: "03", title: "Bootstrappers", body: "Earn distribution without a marketing hire — fix the gaps rivals paid to find." },
  { n: "04", title: "AI-native builders", body: "Get cited when buyers ask an AI assistant — instead of watching rivals take the answer." },
];

export function Audience() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 30px" }}>
      <div style={{ textAlign: "center", marginBottom: 34 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)", textTransform: "uppercase" }}>Built for you</div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 34, letterSpacing: "-0.03em", margin: "12px 0 0" }}>For founders who&apos;d rather ship than study SEO</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {CARDS.map((c) => (
          <div key={c.n} style={{ border: "1px solid var(--c-line)", borderRadius: 16, padding: 22, background: "var(--c-surface)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--c-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, fontWeight: 700, color: "var(--c-action)", fontSize: 14 }}>{c.n}</div>
            <h3 style={{ fontFamily: SG, fontWeight: 600, fontSize: 16, margin: "14px 0 5px" }}>{c.title}</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
