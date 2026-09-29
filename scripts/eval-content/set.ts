// scripts/eval-content/set.ts — the evaluation set of #1132: ten real sites
// every generation change is graded on.
//
// Six are named by the issue. Four are the owner's to pick (#1132: "one local
// service business, one e-commerce shop, one agency and one B2B services
// firm"). Until the owner names them their slots stay `null`, the run skips
// them, and the table says each one is waiting for the owner.
//
// A domain is added by naming it here and committing its snapshot at
// `./snapshot/<domain>.json` (`node scripts/eval-content.mjs --pages <domain>`
// fills the snapshot's page text once its stored report is in it).

export interface EvalSlot {
  /** What kind of business the slot stands for. */
  kind: string;
  /** `null` until the owner names the domain. */
  domain: string | null;
}

export const NAMED: readonly EvalSlot[] = Object.freeze([
  { kind: "ReachKit itself", domain: "reachkit.app" },
  { kind: "SaaS: product development", domain: "linear.app" },
  { kind: "SaaS: web analytics", domain: "plausible.io" },
  { kind: "SaaS: to-do list", domain: "todoist.com" },
  { kind: "SaaS: sales CRM", domain: "pipedrive.com" },
  { kind: "SaaS: customer messaging", domain: "crisp.chat" },
]);

// ── FOR THE OWNER ───────────────────────────────────────────────────────
// Put a domain on each line below. Then ask for its snapshot to be taken
// (the stored report of its latest scan, and its pages) and run the script.
export const OWNER_PICKS: readonly EvalSlot[] = Object.freeze([
  { kind: "A local service business", domain: null },
  { kind: "An e-commerce shop", domain: null },
  { kind: "An agency", domain: null },
  { kind: "A B2B services firm", domain: null },
]);
// ────────────────────────────────────────────────────────────────────────

export const EVAL_SET: readonly EvalSlot[] = Object.freeze([...NAMED, ...OWNER_PICKS]);
