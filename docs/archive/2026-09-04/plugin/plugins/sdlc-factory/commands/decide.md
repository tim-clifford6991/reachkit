---
description: Owner · State a ruling and have it recorded as a decision
---
I state a ruling below. Invoke the architect subagent to record it as an
ADR that `decides-for` the artifact(s) it binds.

If no ADR yet stands on this question, the architect writes a new one,
status `proposed`.

If an ADR already stands on this question, what happens depends on its
status (rule 2.2b: `proposed → accepted → superseded`):
- **`proposed`** — nothing has been accepted yet, so the architect may
  edit it in place.
- **`accepted`** or **`superseded`** — the architect never edits it in
  place. It writes a new ADR, status `proposed`, whose `supersedes:` names
  the standing one. A ruling that changes an accepted decision is itself a
  new decision, not a silent rewrite of the old one.

One ruling, one ADR either way — never split across files, never folded
into an unrelated one.

If the ruling changes what the product promises, the architect also sets
the affected REQ(s) to `status: in-review` in the same pass and says so in
the return — a ruling that changes a promise is not a quiet edit; the
requirement it touches goes back through the gate.

Return: the ADR (new, or new-and-superseding), what it `decides-for`, and
whether any REQ moved to `in-review` and why.

Ruling: $ARGUMENTS
