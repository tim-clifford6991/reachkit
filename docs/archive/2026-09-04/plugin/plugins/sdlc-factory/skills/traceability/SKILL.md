---
name: traceability
description: Rules for maintaining the traceability registry linking REQ → BP → WO → TST → FB. Used by the librarian and consulted by all agents when updating registries.
---

# Traceability

The registry is generated, never written (constitution rule 5.1). There is
no hand-maintained traceability table to update — `registry/generated/traceability.md`
is projected from every artifact's own front-matter, and the librarian
regenerates it on /sync and for /factory's state report.

The console also reads a derived layer beneath the artifact graph: commit
references and code anchors (rule 5.6). It resolves each commit's
`type(WO-###): …` subject and each blueprint's `code:` globs against git
history itself — neither is transcribed into a registry. A work order's
`Branch:` note is a hint for a human reading the file; the commit reference
is the claim the console checks.

## Front-matter is the edge

Every artifact opens with a YAML front-matter block. The field order is
fixed (`id`, `type`, `title`, `status`, then `severity` for feedback only,
then the type's upstream edge field, then `depends-on`, `blocked-by`,
`rests-on`, `supersedes`) — see the `_TEMPLATE.md` in each artifact
directory for the exact block per type.

The upstream edge field differs by type, and this is where `satisfies` vs
`covers` matters (constitution rule 5.4):

| Type | Upstream field | Meaning |
|---|---|---|
| blueprint | `satisfies` | this node was cut from that requirement — gate-bearing |
| blueprint | `covers` | this requirement's behaviour lives here, but didn't originate it — not gate-bearing |
| decision | `decides-for` | this ADR decided something for that blueprint |
| work-order | `implements` | this WO was cut from that blueprint/requirement |
| feedback | `about` | this feedback concerns that artifact |

A requirement transcribed from running code (`/codebase-scan`) is `covers`, never
`satisfies` — the code came first, so the requirement cannot be its
ancestor.

## Invariants (violations are reportable findings)

- Every approved REQ has ≥1 BP node citing it via `satisfies`.
- Every approved BP leaf has ≥1 WO before implementation starts.
- Every merged WO has a passing TST entry appended to it.
- Every code change on main references a WO in its commit message.
- IDs are never reused; superseded artifacts keep their ID with status
  `superseded`, and the survivor points back via `supersedes` — the one
  stored direction. The reverse is derived from the graph; a hand-written
  `superseded-by` field is not in the grammar and the parser drops it
  silently, so never write one.

## Anchors, not line numbers

Cite with `path + symbol` or `path + verbatim quote`, never bare
`path:line` (rule 5.3). A line number rots on the next edit and becomes a
wrong address that still reads as plausible; a quote or symbol fails
loudly when it no longer matches.

## Update timing

The agent that creates or changes an artifact sets its own front-matter in
the same turn. The librarian never hand-edits a generated view — if
`registry/generated/*` looks wrong, the fix is the source artifact's
front-matter, not the generated file.
