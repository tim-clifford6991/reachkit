/**
 * EvidencePanel — reusable evidence display used by all four report sections.
 *
 * Renders one or more evidence items (excerpt + source) from ActionCard or
 * Finding evidence arrays. Used in WhatYouOfferSection, WhoItsForSection,
 * WhereTheyAreSection, and ActionPlanSection.
 *
 * §5.6 acceptance rule: every element here answers a question or moves the Score.
 * This component moves the Score by surfacing the "why" behind each claim.
 */

import type { FindingEvidence, ActionCardEvidence } from "@/lib/llm/types";

type EvidenceItem = FindingEvidence | ActionCardEvidence;

interface EvidencePanelProps {
  items: EvidenceItem[];
  /** Optional: collapse to first N items (unlocked in paid tier) */
  maxVisible?: number;
  className?: string;
}

export function EvidencePanel({
  items,
  maxVisible,
  className,
}: EvidencePanelProps) {
  if (items.length === 0) return null;

  const visible = maxVisible !== undefined ? items.slice(0, maxVisible) : items;
  const hidden = maxVisible !== undefined ? items.length - visible.length : 0;

  return (
    <div className={className}>
      <ul className="space-y-2">
        {visible.map((ev, i) => (
          <li
            key={i}
            className="rounded-lg px-3 py-2.5"
            style={{ background: "var(--fill-subtle)" }}
          >
            <p
              className="text-xs italic leading-relaxed"
              style={{ color: "oklch(0.90 0 0)" }}
            >
              &ldquo;{ev.excerpt}&rdquo;
            </p>
            <p
              className="mt-1 font-mono text-[10px]"
              style={{ color: "var(--color-muted)" }}
            >
              {ev.source}
              {"sourceType" in ev && ev.sourceType && (
                <span style={{ color: "var(--hairline-strong)" }}>
                  {" "}· {ev.sourceType}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p
          className="mt-2 font-mono text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          +{hidden} more source{hidden === 1 ? "" : "s"} in your full report
        </p>
      )}
    </div>
  );
}
