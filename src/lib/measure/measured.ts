// BUILD §5 — REQ-004's trichotomy — measured, zero, unmeasured.
// src/lib/measure/measured.ts — WO-277 (consolidates WO-052), BP-024
//
// The trichotomy REQ-004 makes a customer promise. Every stored number and
// every rendered number in the product is one of these three arms: a real
// value, a real value that happens to be zero, or an admission that the
// scan could not produce one — and why. There is no fourth arm and no
// escape hatch that lets a caller manufacture a value from nothing
// (REQ-004 criterion 12).
//
// `Measured<T>` is a plain discriminated union — not a class, no methods,
// no prototype (BP-024's NFR budget: "a per-value allocation and nothing
// more").

/** 'undeterminable' = REQ-004 criterion 6 (nothing returned / unreadable /
 *  no answer). 'not_attempted' = REQ-004 criterion 9 (90s ceiling or spend
 *  ceiling). */
export type UnmeasuredReason = "undeterminable" | "not_attempted";

export type Measured<T> =
  | { kind: "measured"; value: T; at: Date }
  | { kind: "zero"; value: T; at: Date }
  | { kind: "unmeasured"; reason: UnmeasuredReason; at: Date };

/** The only constructors. There is no `Measured.of(number | null)`: a
 *  nullable number cannot say why, and the whole point of REQ-004 is that
 *  it must. `at` is always the caller's — none of the three reads a clock. */
export function measured<T>(value: T, at: Date): Measured<T> {
  return { kind: "measured", value, at };
}
export function measuredZero<T>(zero: T, at: Date): Measured<T> {
  return { kind: "zero", value: zero, at };
}
export function unmeasured<T>(reason: UnmeasuredReason, at: Date): Measured<T> {
  return { kind: "unmeasured", reason, at };
}

/** Preserves the arm and the `at`; never touches the `unmeasured` arm's
 *  reason and never calls `f` over it. */
export function mapMeasured<A, B>(m: Measured<A>, f: (a: A) => B): Measured<B> {
  if (m.kind === "unmeasured") return m;
  return { kind: m.kind, value: f(m.value), at: m.at };
}

/** BP-024 decision 3: `undeterminable` outranks `not_attempted` whenever a
 *  factor's inputs disagree — the stronger, always-true claim ("we tried
 *  and could not determine it") over the weaker one ("we did not get to
 *  it"). Commutative and idempotent by construction. */
export function worseReason(a: UnmeasuredReason, b: UnmeasuredReason): UnmeasuredReason {
  return a === "undeterminable" || b === "undeterminable" ? "undeterminable" : "not_attempted";
}

// `Values<A>` is the tuple of the `value` types of `A`'s arms; a local type
// helper, not part of the exported surface BP-024 declares.
type Values<A extends readonly Measured<unknown>[]> = {
  [K in keyof A]: A[K] extends Measured<infer V> ? V : never;
};

/** Total: never throws, never calls `f` when any part is `unmeasured`.
 *
 *  - Any part `unmeasured` → `unmeasured`, carrying the fold of every
 *    unmeasured part's reason under `worseReason` (REQ-004 c6, c9).
 *  - Otherwise, `f` is applied to the parts' values. The result's own kind
 *    is `zero` only when every part was `zero`; a single `measured` part
 *    among zeros makes the whole `measured` — real information entered,
 *    "a zero is a value" but not the identity that swallows one (WO-052's
 *    own test row deliberately leaves this a two-way choice; this is the
 *    parameter, rule 1.1, chosen here and recorded once).
 *  - `at` is taken from the first part. Every caller in this module passes
 *    parts that already share one `at` (one scan's `measuredAt`, enforced
 *    downstream by `verdict.ts`'s own consistency assertion), so any part's
 *    `at` would do; the first is simplest. `combine` itself never
 *    validates that invariant — it is total and does not throw. */
export function combine<A extends readonly Measured<unknown>[], B>(
  parts: A,
  f: (values: Values<A>) => B
): Measured<B> {
  let reason: UnmeasuredReason | undefined;
  for (const part of parts) {
    if (part.kind === "unmeasured") {
      reason = reason === undefined ? part.reason : worseReason(reason, part.reason);
    }
  }
  const at = (parts[0] as Measured<unknown> | undefined)?.at ?? new Date(0);
  if (reason !== undefined) {
    return { kind: "unmeasured", reason, at };
  }
  const allZero = parts.every((part) => part.kind === "zero");
  const values = parts.map((part) => (part as { value: unknown }).value) as unknown as Values<A>;
  const value = f(values);
  return { kind: allZero ? "zero" : "measured", value, at };
}
