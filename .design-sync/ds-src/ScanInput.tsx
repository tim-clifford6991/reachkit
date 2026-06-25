import * as React from "react";

/**
 * ScanInput — ReachKit's signature "Analyze my site" conversion control: a
 * rounded pill field (URL placeholder) with a docked violet action button.
 * Presentational (read-only); renders fully with no props.
 */
export interface ScanInputProps {
  placeholder?: string;
  defaultValue?: string;
  buttonLabel?: string;
  note?: string;
  size?: "md" | "lg";
}

export function ScanInput({
  placeholder = "yoursite.com or App Store link",
  defaultValue,
  buttonLabel = "Analyze my site",
  note = "Free scan · no signup · ~90 seconds",
  size = "lg",
}: ScanInputProps) {
  const lg = size === "lg";
  return (
    <div style={{ width: "100%", textAlign: "center" }}>
      <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)", padding: `${lg ? 8 : 6}px ${lg ? 8 : 6}px ${lg ? 8 : 6}px ${lg ? 22 : 18}px`, boxShadow: "0 1px 2px rgba(40,33,84,0.04), 0 18px 44px -26px rgba(110,86,247,0.35)" }}>
        <input type="text" inputMode="url" readOnly defaultValue={defaultValue} placeholder={placeholder} aria-label="Your website URL or App Store link" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-sans)", fontSize: lg ? 16.5 : 15, fontWeight: 500, color: "var(--c-ink)" }} />
        <button type="submit" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", fontFamily: "var(--font-sans)", fontSize: lg ? 15 : 14, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--c-on-dark)", background: "var(--c-action)", border: "1px solid transparent", borderRadius: "var(--radius-full)", padding: `${lg ? 13 : 11}px ${lg ? 22 : 18}px`, cursor: "pointer", boxShadow: "0 8px 20px -10px rgba(110,86,247,0.65)" }}>
          {buttonLabel}<span aria-hidden="true">→</span>
        </button>
      </form>
      {note ? <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.5, color: "var(--c-faint)", margin: "12px 0 0" }}>{note}</p> : null}
    </div>
  );
}
