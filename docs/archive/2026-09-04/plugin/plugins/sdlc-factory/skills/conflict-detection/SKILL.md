---
name: conflict-detection
description: Procedure for finding and logging contradictions between artifacts, and between docs and code. Run on every new or changed artifact.
---

# Conflict Detection

A conflict is a state, not a file (constitution rule 2.3): a `blocked-by`
edge in the newer or dependent artifact's own front-matter, naming the
artifact it contradicts, with the reasoning written in the body of the
artifact that declares it.

Check the new/changed artifact against:
1. Same-level artifacts (REQ vs REQ: contradictory behavior, duplicate
   scope, incompatible priorities).
2. Upstream (does this WO violate its BP interface? does this BP violate a
   REQ constraint?).
3. Downstream (does changing this REQ invalidate existing BP/WO/tests?).
4. Reality (does code on main contradict the artifact?).
5. Decisions (does this contradict a recorded ADR, standalone or inline?).
6. Ownership (does this artifact claim scope owned by another BP node, or
   plan a second implementation of an indexed capability?). Check
   sdlc-factory/docs/registry/structure.md and sdlc-factory/docs/registry/capabilities.md.

On a hit: add the ID to `blocked-by:` in the artifact's front-matter, write
the description, evidence and recommended resolution in its body, and
leave the artifact `in-review` rather than `approved`. The librarian's
generator projects every open `blocked-by` edge into
`registry/generated/blocked.md`; do not maintain that view by hand.

Present the user both sides with a recommended resolution and the cost of
each option, and stop work on the affected chain until it's cleared — but
only escalate the decision itself if it changes what the product promises
(rule 1.3); otherwise resolve it yourself and record the reasoning. A
resolution that is itself architecturally significant becomes an ADR
(rule 2.2).

Never resolve a conflict silently, even when one side seems obviously
right — the edge and its reasoning are the record that it was checked.
