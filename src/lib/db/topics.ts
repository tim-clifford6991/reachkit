// src/lib/db/topics.ts
//
// `structure.md` rule 3: "Migrations are topic-prefixed and topic-owned.
// All migrations live in `supabase/migrations/`; BP-002 owns the baseline
// (`*_baseline*.sql`), the RLS policy files (`*_rls*.sql`),
// `*_domainblocks*.sql` ... and the clients. Every other node globs its own
// topic token and no other node may use it: users · sites · scans ·
// fetches · opportunities · drafts · publications · destinations · leads ·
// suppressions." Rule 3a: "A component holds a token; a leaf narrows it
// with a sub-token and owns that file, by rule 2's precedence ... A
// sub-token is not a new topic and needs no entry in the closed list
// above." Rule 2: "the narrower glob owns the file."
//
// Owner BP ids below are read from each node's own `code:` glob — BP-002
// `## Data model delta`: "it is not a second declaration of the delta (rule
// 2.4), and where an entry and its owning node disagree, the owning node is
// right." Two entries disagree with BP-002's own index table as written:
// `structure.md`'s `src/lib/publish/**` row records BP-015's migration glob
// "withdrawn 2026-09-01 under rule 2a" — `*_publications*.sql` is BP-045's
// (`supabase/migrations/*_publications*.sql` in BP-045's own `code:`) and
// `*_destinations*.sql` is BP-058's (same, in BP-058's `code:`), not
// BP-015's as BP-002's table still reads. Every other owner below matches
// both BP-002's table and the owning node's own `code:` glob.

export interface MigrationTopic {
  readonly token: string;
  readonly owner: string;
}

export interface MigrationSubtoken {
  readonly token: string;
  readonly parent: string;
  readonly owner: string;
}

// The closed topic list (`structure.md` rule 3) plus BP-002's own three
// (`baseline`, `rls`, `domainblocks` — BP-002 `## Decisions` 2).
export const MIGRATION_TOPICS: readonly MigrationTopic[] = [
  { token: "baseline", owner: "BP-002" },
  { token: "rls", owner: "BP-002" },
  { token: "domainblocks", owner: "BP-002" },
  { token: "users", owner: "BP-017" },
  { token: "sites", owner: "BP-017" },
  { token: "scans", owner: "BP-012" },
  { token: "fetches", owner: "BP-007" },
  { token: "opportunities", owner: "BP-013" },
  { token: "drafts", owner: "BP-014" },
  { token: "publications", owner: "BP-045" },
  { token: "destinations", owner: "BP-058" },
  { token: "leads", owner: "BP-029" },
  { token: "suppressions", owner: "BP-029" },
];

// The open sub-token list (`structure.md` rule 3a) — each narrows exactly
// one parent topic above and is owned by the leaf that specified the
// column(s) it carries (BP-002 `## Data model delta`'s index, and
// `structure.md`'s per-leaf `code:` globs).
export const MIGRATION_SUBTOKENS: readonly MigrationSubtoken[] = [
  // `users_billing` — the columns Checkout writes (issue #33, BUILD §13).
  // BP-030 is the checkout leaf inside BP-017; the sub-token narrows the
  // `users` topic so `users_provisioning` and this one cannot both claim
  // one file.
  { token: "users_billing", parent: "users", owner: "BP-030" },
  { token: "users_provisioning", parent: "users", owner: "BP-032" },
  { token: "users_subscription", parent: "users", owner: "BP-060" },
  { token: "users_identity", parent: "users", owner: "BP-061" },
  { token: "users_erasure", parent: "users", owner: "BP-063" },
  { token: "sites_provisioning", parent: "sites", owner: "BP-031" },
  { token: "sites_hosting", parent: "sites", owner: "BP-060" },
  { token: "sites_setup", parent: "sites", owner: "BP-033" },
  { token: "sites_erasure", parent: "sites", owner: "BP-063" },
  { token: "scans_freepath", parent: "scans", owner: "BP-023" },
  { token: "scans_verdict", parent: "scans", owner: "BP-024" },
  { token: "opportunities_core", parent: "opportunities", owner: "BP-040" },
  { token: "opportunities_supply", parent: "opportunities", owner: "BP-041" },
  { token: "opportunities_verdicts", parent: "opportunities", owner: "BP-051" },
  { token: "drafts_core", parent: "drafts", owner: "BP-042" },
  { token: "drafts_claims", parent: "drafts", owner: "BP-043" },
  // Issue #45, BUILD §9: the state machine's own two columns on `drafts`
  // (`transitions`, `publishable_since`) and the switch on `sites`. Both
  // narrow a topic another node owns, which is exactly what rule 3a is
  // for — "a leaf narrows it with a sub-token and owns that file".
  { token: "drafts_publishing", parent: "drafts", owner: "BP-045" },
  { token: "sites_publishing", parent: "sites", owner: "BP-045" },
];

/**
 * Resolves a migration filename to the one topic or sub-token it carries.
 * `structure.md` rule 2: "the narrower glob owns the file" — a matching
 * sub-token supersedes its parent topic rather than counting as a second,
 * ambiguous match. Returns `null` when the name carries no assigned token,
 * or more than one — both are naming-convention failures, never a fallback
 * guess.
 */
export function topicOf(filename: string): MigrationTopic | null {
  const base = filename
    .replace(/^.*\//, "")
    .replace(/\.sql$/, "");
  const words = base.split("_").filter((word) => word.length > 0);

  const subtokenMatches = MIGRATION_SUBTOKENS.filter((sub) =>
    containsSubsequence(words, sub.token.split("_"))
  );
  const parentsConsumed = new Set(subtokenMatches.map((sub) => sub.parent));

  const topicMatches = MIGRATION_TOPICS.filter(
    (topic) => words.includes(topic.token) && !parentsConsumed.has(topic.token)
  );

  const matches: MigrationTopic[] = [
    ...subtokenMatches.map((sub) => ({ token: sub.token, owner: sub.owner })),
    ...topicMatches,
  ];

  if (matches.length !== 1) return null;
  // `noUncheckedIndexedAccess` cannot see that the length check above makes
  // this element defined; the explicit check keeps the function's own
  // return type (`MigrationTopic | null`, never `| undefined`) exact.
  const [only] = matches;
  return only ?? null;
}

function containsSubsequence(
  haystack: readonly string[],
  needle: readonly string[]
): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}
