import type { ReactNode } from "react";

/**
 * THE numeral utility — tokens.md §4, BUILD.md §2.3.
 *
 * "Every numeral, date, URL, search query and code-like string is JetBrains
 * Mono with tabular-nums." The rule is mechanical: this component is the
 * only thing in src/ that emits the `num` class, and `num` is the only rule
 * in globals.css that sets font-family: var(--font-mono) on running text.
 * A caller therefore cannot take the mono face without tabular-nums, or the
 * other way round. A numeral rendered outside <Num> is a defect and is
 * visible as one — the figures do not line up.
 */
export function Num({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>;
}
