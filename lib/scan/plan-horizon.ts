/**
 * Impact-horizon for a plan entry — the short/medium/long framing shown on the
 * Plan page. By kind (post/reply = quick, content = this-week, distribution =
 * compounding), with a nuance: a low-effort community reply is a Quick win, not
 * a long compounding play. Deterministic + total. PURE.
 */
export type Horizon = "short" | "medium" | "long";
export const HORIZON_LABEL: Record<Horizon, string> = { short: "Quick win", medium: "This week", long: "Compounding" };

export function horizonForEntry(e: { kind: "post" | "content" | "distribution"; channel: string | null; effortMin: number }): Horizon {
  if (e.kind === "post") return "short";
  if (e.kind === "content") return "medium";
  // distribution: a quick community reply/comment is a short quick-win; a
  // directory/marketplace/backlink placement compounds over time.
  if (e.channel === "community" || e.effortMin <= 6) return "short";
  return "long";
}
