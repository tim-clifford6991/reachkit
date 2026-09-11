# docs/archive — superseded, read-only

Dated things whose content has been folded into `SPEC.md`, `DECISIONS.md` or `PROCESS.md`, or which
a later artifact replaced. A file here is kept so the reasoning and the drawing survive; **it is
never an authority**, never edited, and never cited by an issue. Where an archived file and
`SPEC.md` disagree, `SPEC.md` wins.

(This is not `archive/` at the repository root, which is the frozen 2026-09-04 sdlc-factory corpus
and *is* the detail an issue cites.)

| Entry | What it was | Where it lives now |
|---|---|---|
| `2026-09-08-parent-artifact/reachkit-screen-system.html` | The owner's eight-screen artifact, approved 2026-09-08 — the **parent** of the approved set. The set was derived from this artifact's own code with the twelve rulings of that date applied, and supersedes it. | The approved artifact is `docs/design/approved/full-set/`. |
| `2026-09-08-parent-artifact/screens/*.png` | Sixteen renders of the parent artifact (eight screens × light/dark). | The approved renders are `docs/design/approved/full-set/screens/*.png`. |
| `2026-09-08-parent-artifact/literals.md` | The parent artifact's value inventory — which literals it spent without a token name. Its mappings are provenance, never a requirement (owner ruling 2026-09-11); ruling 8a struck `--r-card`. | Tokens are `docs/design/approved/tokens.css`; the rule against bare literals is `ARCHITECTURE.md`. |
| `DECISIONS-full-2026-09-11.md` | `DECISIONS.md` exactly as it stood before the 2026-09-11 split — every row, product, process and implementation alike. | Product rulings: `DECISIONS.md`. Process rulings: `PROCESS.md` §8. Implementation rulings: a comment at the module. *(Lands with the DECISIONS PR.)* |
| `autopilot-quality-2026-09-10.md` | The owner's Autopilot quality & discoverability brief, 2026-09-10, verbatim. | §1.1–§1.12 are `DECISIONS.md` rows of 2026-09-10; §2–§10 are in `SPEC.md` §4.3, §4.6, §4.7, §7, §8, §9. *(Lands with the SPEC PR.)* |
