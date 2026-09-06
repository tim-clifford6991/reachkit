// BUILD §9 — the four outcomes REQ-062 criterion 1 names, as data.
//
// Its own module, and deliberately a tiny one: the mail template that
// renders the four rows needs the list and must not reach a database to get
// it. `verify.ts` re-exports both names, so a caller inside the publishing
// subsystem reads them from the module that produces the checks.
//
// The order is the order criterion 1 states them in, and it is the order
// every surface lists them in — a `Record<CheckId, …>` over this union is
// what makes "each of those four outcomes is shown" (criterion 2) a
// compile-time obligation rather than a list somebody keeps.

export const CHECK_IDS = ["reachable", "indexable", "sitemap", "aiReadable"] as const;

export type CheckId = (typeof CHECK_IDS)[number];
