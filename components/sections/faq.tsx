/**
 * FAQ — §21.1 marketing section
 *
 * Accordion-style FAQ using <details>/<summary> (native, zero JS, accessible).
 * Automatically emits FAQPage JSON-LD via lib/seo.ts faqPageLd() from its
 * `items` prop — structured data stays in sync with visible content.
 *
 * Dark-first, on design tokens. Reduced-motion-safe (CSS transition only).
 */

import { faqPageLd, type FaqItem } from "@/lib/seo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqContent {
  eyebrow?: string;
  headline: string;
  items: readonly FaqItem[];
}

export interface FaqProps {
  content: FaqContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Faq({ content }: FaqProps) {
  const { eyebrow, headline, items } = content;
  const ld = faqPageLd(items);

  return (
    <section
      className="flex flex-col items-center gap-10 px-[--spacing-content-x] py-[--spacing-section-y]"
      aria-label="Frequently asked questions"
    >
      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      {/* Header */}
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
        >
          {headline}
        </h2>
      </div>

      {/* Accordion */}
      <div
        className="w-full max-w-2xl"
        role="list"
        aria-label="FAQ items"
      >
        {items.map((item, i) => (
          <details
            key={item.q}
            role="listitem"
            className="faq-item group border-b"
            style={{ borderColor: "oklch(1 0 0 / 0.08)" }}
          >
            <summary
              className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-sm font-medium"
              style={{ color: "var(--color-fg)" }}
            >
              <span>{item.q}</span>
              {/* Chevron — rotates on open via CSS */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="faq-chevron mt-0.5 shrink-0 transition-transform duration-200"
                style={{ color: "var(--color-muted)" }}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>

            <div
              className="pb-4 text-sm leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              {item.a}
            </div>

            {/* First item: no top border (header acts as separator) */}
            {i === 0 && (
              <style>{`details.faq-item:first-child { border-top: 1px solid oklch(1 0 0 / 0.08); }`}</style>
            )}
          </details>
        ))}
      </div>

      {/* Chevron rotation when open */}
      <style>{`
        details[open] .faq-chevron {
          transform: rotate(180deg);
        }
        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </section>
  );
}
