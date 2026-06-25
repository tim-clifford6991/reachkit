import * as React from "react";

/** Alert — a tinted banner (info/success/warning/error): leading dot, bold title, message. Renders with no props. */
export type AlertTone = "info" | "success" | "warning" | "error";
export interface AlertProps { tone?: AlertTone; title?: string; children?: React.ReactNode; }
const TONES: Record<AlertTone, { bg: string; accent: string }> = {
  info: { bg: "var(--c-soft)", accent: "var(--c-action)" },
  success: { bg: "var(--c-tint-green)", accent: "#1F9D5B" },
  warning: { bg: "var(--c-tint-amber)", accent: "#C98A12" },
  error: { bg: "var(--c-tint-red)", accent: "#E5484D" },
};
export function Alert({ tone = "info", title = "Heads up", children = "This is a contextual message to keep you informed." }: AlertProps) {
  const { bg, accent } = TONES[tone] ?? TONES.info;
  return (
    <div role="status" style={{ maxWidth: 480, boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 12, background: bg, border: "1px solid " + accent + "33", borderRadius: "var(--radius-lg)", padding: "14px 16px", fontFamily: "var(--font-sans)" }}>
      <span style={{ flex: "0 0 auto", marginTop: 6, width: 8, height: 8, borderRadius: "var(--radius-full)", background: accent, boxShadow: "0 0 0 4px " + accent + "26" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: accent, lineHeight: 1.3 }}>{title}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: "var(--c-ink)" }}>{children}</span>
      </div>
    </div>
  );
}
