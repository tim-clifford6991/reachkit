// BUILD §9 — the four outcomes REQ-062 criterion 1 names, as data, in the order every surface lists them.
// Its own tiny module so the mail template gets the list without reaching a database.
// A `Record<CheckId, …>` over this union makes "each of the four outcomes is shown" a compile-time obligation.

export const CHECK_IDS = ["reachable", "indexable", "sitemap", "aiReadable"] as const;

export type CheckId = (typeof CHECK_IDS)[number];
