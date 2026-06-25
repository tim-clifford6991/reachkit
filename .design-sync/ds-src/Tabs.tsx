import * as React from "react";

/** Tabs — a horizontal tab bar; the active tab gets violet text + a violet underline, inactive are muted. Renders with no props. */
export interface TabsProps { tabs?: string[]; activeIndex?: number; }
export function Tabs({ tabs = ["Overview", "Fixes", "History"], activeIndex = 0 }: TabsProps) {
  const VIOLET = "#6E56F7";
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 4, maxWidth: 420, borderBottom: "1px solid var(--c-line)", fontFamily: "var(--font-sans)" }}>
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        return (
          <button key={i} type="button" style={{ position: "relative", padding: "10px 14px", marginBottom: -1, background: "transparent", border: "none", borderBottom: `2px solid ${active ? VIOLET : "transparent"}`, color: active ? VIOLET : "var(--c-muted)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: active ? 600 : 500, cursor: "pointer", lineHeight: 1.2 }}>{tab}</button>
        );
      })}
    </div>
  );
}
