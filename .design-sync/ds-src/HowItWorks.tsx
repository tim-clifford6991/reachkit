/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * HowItWorks — the landing's three numbered step cards (01 Paste your URL /
 * 02 See the searches your rivals win / 03 Work the queue, watch the gap close).
 * Mirrors the 3-step grid on the live landing (`landing-html.ts`).
 */
export interface HowItWorksProps {
  _unused?: never;
}

const STEPS = [
  { n: "01", title: "Paste your URL", body: "That's the whole setup — no signup, no tracking code, under a minute. ReachKit reads your live page the way a buyer's search does: title, headings, schema, content, links. No guessing." },
  { n: "02", title: "See the searches your rivals win", body: "The specific searches your buyers run where a competitor shows up and you don't — each with a plain-English reason — and one Discoverability Score that measures exactly how wide the gap is." },
  { n: "03", title: "Work the queue, watch the gap close", body: "A short weekly queue ranked by impact, biggest lever first. Mark a fix done and ReachKit re-checks your live page — only then does your score move. Watch the gap close, week after week." },
];

export function HowItWorks() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 56px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
        {STEPS.map((s) => (
          <div key={s.n} style={{ border: "1px solid var(--c-line)", borderRadius: 16, padding: 26, background: "var(--c-surface)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--c-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--c-action)", fontSize: 16 }}>{s.n}</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, margin: "16px 0 6px" }}>{s.title}</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
