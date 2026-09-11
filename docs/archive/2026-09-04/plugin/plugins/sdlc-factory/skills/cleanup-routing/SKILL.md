---
name: cleanup-routing
description: What /requirement-cleanup displaces from an overgrown requirement, where each kind goes, and the rule each move serves. Used by the requirements-analyst's Requirement cleanup procedure and by the architect when it accepts displaced citations.
---

# Requirement cleanup

`/requirement-cleanup` brings a requirement that has grown past rule 2.1's
one page back to one page. It never rewrites acceptance criteria — it only
removes what a REQ must not contain (constitution §2) and relocates each
kind to the one place it already has a home. Requirement cleanup is a
rewrite, not a prune: nothing found on the requirement is discarded, only
moved or proposed.

## Scope

- `/requirement-cleanup JN-001` — every requirement the journey's steps
  `exercises`.
- `/requirement-cleanup REQ-012 REQ-013 …` — exactly the requirements named.
- `/requirement-cleanup --all` — every requirement in the corpus, journey by
  journey (in journey order), requirements on no journey last.

The corpus is the checkpoint, so `--all` is resumable without extra state:
a requirement whose latest `requirements/history/` entry is a
requirement-cleanup entry and whose `status` is `in-review` was already
cleaned up by a prior run that hasn't been re-approved yet — skip it and
list it as "already cleaned up" rather than redoing the pass.

## Where each kind of bullet goes

| Found on the requirement | Goes to | Why |
|---|---|---|
| Narrative, amendment notes | one dated file, `requirements/history/<REQ>-<date>-requirement-cleanup.md`, content verbatim | rule 2.1 — a REQ carries no edit history of its own |
| `- Source:` / evidence lines | `registry/evidence/<REQ>.md` — created if absent, appended if present — cited once from the rewritten rationale | rule 2.1 — evidence lives in the registry, not the REQ |
| `- Implemented by:` / `- Pinned by:` | a proposal to the architect: a `code:` glob on the blueprint the citation names | rule 2.4 — the edge belongs on the blueprint's own field, not restated in prose here |
| `- Satisfied by:` | dropped, nothing written elsewhere | rule 2.4 — the edge already lives in the blueprint's `satisfies:` field; this bullet is the second copy |
| `- Tag:` | dropped from the requirement; kept in the history entry from the same pass | not part of a requirement's behaviour statement, but not lost |
| `- Depends on:` / `- Blocked by:` | dropped, in favor of the `depends-on:`/`blocked-by:` front-matter | this grammar already declares these as edges; a bullet that disagrees with the front-matter loses — front-matter is the graph (rule 5.2) |

Acceptance criteria are never paraphrased in this process — carried
verbatim, renumbered only when two duplicates collapse into one.

## Duplicate behaviour

Where two requirements state the same behaviour, the survivor is decided by
count, not judgement: Grep `blueprints/` and `work-orders/` for
front-matter `satisfies:`/`implements:` lines naming each REQ id —
front-matter only, never a prose mention — and sum the lines naming each
one across both directories. The larger count survives — least churn for
what already points at it; a tie goes to the lower REQ id. The analyst
records both counts, and the id each belongs to, in the history entry
(rule 1.1); the owner may overrule it. The survivor absorbs the union of both
requirements' acceptance criteria, verbatim, and gains
`supersedes: [REQ-xxx]`. The other requirement is set to
`status: superseded` immediately — self-certified, the same as the
`in-review` drop every rewrite gets (rules 2.2b, 3.2) — so an
`/expand-requirement` run in the gap before the owner reviews this pass
never fans out from a retired duplicate; the owner's review can revert it.
Both moves are named in the report, and the superseded file is never
deleted — nothing this process does writes `status: approved` or removes a
file.

## Placement

Every rewritten requirement is checked against rule 5.7: a journey step's
`exercises` names it, or the rewritten rationale records why not. A
requirement cleaned up off a journey it no longer belongs to needs a new
placement decision, not silence.

## The gate

A requirement that was `status: approved` before this pass drops to
`in-review` the moment its content changes — the owner's signature covered
what they signed, not the rewrite. `/requirement-cleanup` runs `/review`
twice (rule 3.4) before presenting anything: round one by the
requirements-analyst on its own rewrite, round two by `/requirement-cleanup`
itself, invoking the reviewer again. A draft still carrying open
`REVIEW(...)` lines is not presented as ready.

## What the architect does with a displaced citation

The analyst never edits `code:` on a blueprint itself — it hands the
architect the `Implemented by:`/`Pinned by:` lines, each already naming
the requirement and the blueprint the citation claims satisfies it. The
architect turns each into a `code:` glob on that blueprint —
repo-relative, bounded to the module the node owns
(`skills/blueprint-writing/SKILL.md`), never a glob wide enough to match
the whole repo — applies it, and says which line became which glob. It
never edits the requirement.

A citation the architect can't confidently bound to a glob is never
dropped: it goes verbatim into the requirement's history entry (already
written by the analyst) **and** as
`- [ ] REVIEW(gap): citation not anchorable — <the line>` under the
satisfying blueprint's own `## Open questions`, for the architect itself
to resolve later. Both copies exist so the citation survives whether it's
next read from the requirement's side or the blueprint's.

When no non-superseded blueprint satisfies the requirement at all, there is
no blueprint to hand the citation to — the analyst never invokes the
architect for that requirement's displaced citations; they go into the
history entry only, and the run reports "no blueprint yet — anchors
deferred to /expand-requirement" rather than presenting a `REVIEW(gap)`
that has nowhere to live.

## Aftermath

Requirement cleanup retires a duplicate requirement in place; it does not
touch what already points at it. `/relink` is the separate, later pass
that repoints or retires the downstream blueprints and work orders — this
skill owns none of that procedure; see `commands/relink.md`.

## Never

- Never write `status: approved` — only the owner does.
- Never delete a file — a superseded requirement keeps its file, marked.
- Never paraphrase an acceptance criterion while relocating it.
- Never drop a citation the architect can't anchor — it goes to the
  requirement's history entry and to a `REVIEW(gap)` line on the
  blueprint, not nowhere.
