/**
 * ScanInputSection — §21.1 marketing section
 *
 * The primary marketing CTA: reuses the funnel's scan-input client component.
 * Wraps it with a supporting headline and optional context label.
 *
 * Server component wrapper — the actual input is client-side.
 */

import { ScanInput } from "@/app/(marketing)/scan-input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanInputSectionContent {
  /** Overline label above the input */
  label?: string;
  /** Short supporting text below the input */
  support?: string;
}

export interface ScanInputSectionProps {
  content?: ScanInputSectionContent;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanInputSection({ content }: ScanInputSectionProps) {
  return (
    <section
      className="flex flex-col items-center gap-6 px-[--spacing-content-x] py-[--spacing-section-y]"
      aria-label="Scan your product"
    >
      {content?.label && (
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          {content.label}
        </p>
      )}

      <div className="w-full max-w-xl">
        <ScanInput />
      </div>

      {content?.support && (
        <p
          className="text-center text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          {content.support}
        </p>
      )}
    </section>
  );
}
