"use client";

/**
 * Reads a token's value back out of the running document.
 *
 * Rule 2.4 — one claim, one home. globals.css is the only place a token's
 * value is written down. A specimen that RESTATED the value in TypeScript
 * would be minting the second copy, and the second copy is how they
 * diverge: the sheet would keep printing `#5b4be0` long after the CSS
 * changed. So the specimen prints what the browser actually resolved.
 *
 * This is also the first thing on any of these routes that a static sheet
 * could not do honestly. The HTML sheets had to declare every token twice —
 * once per theme pane — precisely because they could not ask the document.
 */
import { useEffect, useState } from "react";

export function useTokenValue(name: string): string {
  const [value, setValue] = useState("");

  useEffect(() => {
    const read = () =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", read);
    };
  }, [name]);

  return value;
}

export function ColourSwatch({ name, used }: { name: string; used: string }) {
  const value = useTokenValue(name);
  return (
    <div className="pv-swatch">
      <div className="pv-swatch-chip" style={{ background: `var(${name})` }} />
      <div className="pv-swatch-meta">
        <p className="pv-mono" style={{ margin: 0 }}>
          {name}
        </p>
        <p className="pv-mono" style={{ margin: 0, color: "var(--pv-dim)" }}>
          {value || "—"}
        </p>
        <p style={{ margin: "var(--s-1) 0 0", fontSize: "var(--t-explain-size)", color: "var(--pv-dim)" }}>
          {used}
        </p>
      </div>
    </div>
  );
}

export function ValueRow({ name, used }: { name: string; used: string }) {
  const value = useTokenValue(name);
  return (
    <tr>
      <td className="m">{name}</td>
      <td className="m">{value || "—"}</td>
      <td>{used}</td>
    </tr>
  );
}
