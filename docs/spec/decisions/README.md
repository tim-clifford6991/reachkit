# Dated SPEC rulings

Since 2026-10-18 (owner, #1525), each new dated ruling on `docs/SPEC.md` is one file here, so two pull requests that each add a ruling never touch the same lines. Since 2026-11-08 (owner C7, #2527) every SPEC section is rewritten, folding its rulings in.

- The name is `YYYY-MM-DD-<issue>.md`, with `-<slug>` added when one issue rules twice on a day.
- The head names the SPEC.md section it belongs to. The ruling follows as SPEC.md writes one: the date, the ruling, who decided it and on which issue.
- `node scripts/spec-decisions.mjs new <issue> <§n>` writes the head. `node scripts/spec-decisions.mjs` lists every ruling under its section.
- `audit` reads these files with SPEC.md: a route, a quoted copy key or a dated marker in one is checked as if it were in SPEC.md, and a file with a bad name, no section, or a section SPEC.md does not have fails.
- A ruling a later one replaces is deleted, as a replaced line in SPEC.md is. The later file may list it on an optional `replaces:` line in its head (`--replaces a.md,b.md`), and `audit` fails while a listed file is still in the tree.

```markdown
---
section: §7
replaces: 2026-10-01-900.md
---

2026-10-18  **What the ruling says** (owner, #1525). …
```
