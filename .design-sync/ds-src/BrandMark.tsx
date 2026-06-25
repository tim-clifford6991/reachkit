import * as React from "react";

export interface BrandMarkProps {
  /** Pixel size of the square mark. */
  size?: number;
  /** Render the "ReachKit" wordmark beside the mark. */
  withWordmark?: boolean;
}

/**
 * ReachKit brand mark — the violet "reach" tile: concentric signal arcs radiating
 * from a center dot. The product's primary identity element.
 */
export function BrandMark({ size = 28, withWordmark = false }: BrandMarkProps) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="9" fill="#6E56F7" />
      <circle cx="14" cy="14" r="1.7" fill="#fff" />
      <path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.36) }}>
      {mark}
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: Math.round(size * 0.62), color: "var(--c-ink)", letterSpacing: "-0.01em" }}>
        ReachKit
      </span>
    </span>
  );
}
