import * as React from "react";

/** TextField — a labeled form input; optional hint, and an error state that turns the border + helper red. Renders with no props. */
export interface TextFieldProps { label?: string; placeholder?: string; value?: string; hint?: string; error?: string; }
export function TextField({ label = "Email", placeholder = "you@company.com", value, hint, error }: TextFieldProps) {
  const ERROR = "#E5484D";
  const hasError = Boolean(error);
  const helper = error ?? hint;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 340, fontFamily: "var(--font-sans)" }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--c-ink)" }}>{label}</label>
      <input readOnly value={value} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--c-ink)", background: "var(--c-surface)", border: `1px solid ${hasError ? ERROR : "var(--c-line)"}`, borderRadius: "var(--radius-lg)", outline: "none" }} />
      {helper ? <div style={{ fontSize: 12.5, lineHeight: 1.4, color: hasError ? ERROR : "var(--c-muted)" }}>{helper}</div> : null}
    </div>
  );
}
