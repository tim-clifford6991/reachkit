# REQ-061 — retired in place, 2026-08-31 (app cluster, Item 5)

REQ-061 stated five promises that had each acquired a home elsewhere in the
corpus. It is set to `status: superseded` and kept as the record of what it said;
the `supersedes: [REQ-046, REQ-061]` edge sits on REQ-045, the survivor holding
criterion 2. The survivor-count rule was inapplicable — `blueprints/` and
`work-orders/` hold no artifact beyond their templates, so the count naming
REQ-061 is 0, as it is for every candidate survivor.

## Criterion-by-criterion verification, before retiring

The instruction was to prove each of the four non-c2 criteria has a genuine home,
and to rehome rather than lose any that does not. Two did not.

| REQ-061 | promise | home | verdict |
|---|---|---|---|
| c1 | every page as Markdown with assets, still available after cancelling | REQ-078 c3 (contents: "every page ReachKit wrote for them … as Markdown files with their assets") and REQ-078 c2 (state: "active, cancelled, or past its paid-through date … never withheld on account of subscription state") | **already homed**, both limbs |
| c2 | Markdown and HTML of any draft or published page available to copy | REQ-045 c12 | **moved** (Merge 2) |
| c3 | unpublishing one page removes it from a destination ReachKit serves, at any time | **none.** REQ-079 c4 covers only "unpublish everything", and REQ-079's own non-goal disclaims the single page. REQ-056 c7 held the state transition (`published`→`unpublished`, "available for as long as the page is published") but said nothing about the page ceasing to be served | **rehomed** to REQ-056 c15, verbatim |
| c4 | unpublishing a WordPress page stops it counting as live and names the post for the customer to remove | **none.** REQ-079 c4 covers only the bulk action, and states a different behaviour (below) | **rehomed** to REQ-056 c16, verbatim |
| c5 | delete account or unpublish everything exports first; nothing destroyed silently | REQ-079 c3 ("an export of their pages is produced and downloaded by them before anything is unpublished or deleted") | **already homed** |

Rehoming target: REQ-056 is the requirement that owns the publish state machine,
already carries the single-page unpublish transition as its criterion 7, and
already reasons about a destination after an unpublish in its criterion 5. Both
criteria were appended verbatim as 15 and 16; no existing REQ-056 criterion
number moved, so its live citations are unaffected. REQ-056 is `status: draft`,
so no gate dropped.

## A conflict the rehoming surfaced — raised, not patched

REQ-061 c4 (now REQ-056 c16) says a WordPress page the customer unpublishes has
its post *named for the customer to remove*, "since ReachKit never made it live"
— which agrees with REQ-060 c1 ("appears in their WordPress site as a draft and
is never made live by us"). REQ-079 c4 says that on "unpublish everything" a page
ReachKit published to WordPress "is returned to draft there" — a write into the
customer's site, presupposing it had been made live. One customer action, two
incompatible promises about what ReachKit touches inside a customer's WordPress.

This predates the pass. It was recorded as
`REVIEW(conflict with REQ-079 criterion 4)` on REQ-056's `## Open questions`,
where the rehomed criterion now lives, and routed to `/decide` — it is an
owner-visible promise about the customer's own site, not a seam a merge closes.
No `blocked-by` edge was set: REQ-079 is `status: draft`, not approved, so rule
1.3's approved-artifact conflict path does not apply.

## Non-goals — where each went

| REQ-061 non-goal | disposition |
|---|---|
| "Charging for, rate-limiting or gating export behind plan state." | dropped from the corpus; the promise it disclaims is carried as behaviour by REQ-078 c2, so it is not a promise living only in a non-goal (ruling T1). Kept verbatim here. |
| "Migrating a customer's pages to another platform on their behalf." | **moved** to REQ-078's non-goals, beside "Importing content into ReachKit" |
| "Deleting or editing posts inside the customer's own WordPress (REQ-060)." | **moved** to REQ-056's non-goals, beside the rehomed criterion 16, and extended to name it |
| "Retaining published pages on a destination ReachKit serves after the customer unpublishes." | dropped from the corpus; the promise is now REQ-056 c15's behaviour ("it is removed from that destination"). Kept verbatim here. |

## Citations repointed (5 files)

- `journeys/JN-003.md` step 9 `exercises`: [REQ-061] → [REQ-045, REQ-056,
  REQ-078] — the step's three verbs, "copying one page, exporting everything, or
  unpublishing a page they regret", now name the three requirements that hold
  them. Journey is `status: draft`, so no approval drop.
- `requirements/REQ-063.md`: `depends-on` REQ-061 → REQ-056 (REQ-048 → REQ-047 in
  the same pass, Merge 1); criterion 6's "the customer unpublished the page
  (REQ-061)" → "(REQ-056 criterion 7)".
- `requirements/REQ-078.md` non-goal: the copy-as-Markdown line repointed to
  REQ-045 criterion 12 (Merge 2); the migration non-goal added.
- `requirements/REQ-079.md` non-goal: "Unpublishing a single page, which is the
  calendar's" → "REQ-056 criteria 7, 15 and 16". The BUILD §9 citation was left.
- `requirements/REQ-056.md`: criteria 15 and 16 added, one non-goal added, one
  `REVIEW(conflict …)` opened.

Nothing inside `REQ-061.md` was repointed; it is the record of what it said. Its
front-matter `depends-on` was empty, so no edge needed unioning anywhere.

## Front-matter

`status: draft` → `status: superseded`. Nothing else on the file changed. The
`supersedes: [REQ-046, REQ-061]` edge is on REQ-045.

## REVIEW lines

- **Died:** none — REQ-061 carried none.
- **Opened:** `REVIEW(conflict with REQ-079 criterion 4)` on REQ-056, above.
