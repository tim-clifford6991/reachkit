/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * StorySection — the landing's problem statement (#story): a centred headline
 * ("You shipped a great product. Nobody can find it.") and a single reframing
 * paragraph ending on "Not more data. The decision." Mirrors the #story section
 * of the live landing (`landing-html.ts`).
 */
export interface StorySectionProps {
  _unused?: never;
}

export function StorySection() {
  return (
    <section style={{ maxWidth: 980, margin: "0 auto", padding: "60px 28px 20px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, letterSpacing: "-0.03em", margin: 0, textWrap: "balance" } as React.CSSProperties}>
        You shipped a great product. <span style={{ color: "var(--c-faint)" }}>Nobody can find it.</span>
      </h2>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", maxWidth: 600, margin: "16px auto 0" }}>
        You&apos;re too close to your own page to see what a buyer&apos;s search sees — and your rivals are winning it while you guess. You don&apos;t need 200 metrics, and you don&apos;t need a chatbot&apos;s guess. You need one number that tells you exactly where you stand, and a short list that tells you what to do about it. <strong style={{ color: "var(--c-ink)" }}>Not more data. The decision.</strong>
      </p>
    </section>
  );
}
