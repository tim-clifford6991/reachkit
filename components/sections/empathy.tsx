/**
 * Empathy — §21.1 marketing section.
 *
 * A short problem-empathy beat (principle #21: show empathy before you sell).
 * Names the founder's pain in their own language before the page pivots to the
 * solution. Content-as-props, server component, on design tokens.
 */

export interface EmpathyContent {
  /** Mono eyebrow label */
  eyebrow?: string;
  /** The lead line — the gut-punch (rendered large) */
  lead: string;
  /** The turn — the reframe toward the solution */
  turn: string;
}

export interface EmpathyProps {
  content: EmpathyContent;
}

export function Empathy({ content }: EmpathyProps) {
  const { eyebrow, lead, turn } = content;

  return (
    <section
      className="flex flex-col items-center gap-5 px-(--spacing-content-x) py-(--spacing-section-y) text-center"
      aria-label="The problem"
    >
      {eyebrow && (
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          {eyebrow}
        </p>
      )}
      <p
        className="max-w-2xl text-2xl font-semibold leading-snug sm:text-3xl lg:text-4xl"
        style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
      >
        {lead}
      </p>
      <p
        className="max-w-xl text-base leading-relaxed sm:text-lg"
        style={{ color: "var(--color-muted)" }}
      >
        {turn}
      </p>
    </section>
  );
}
