---
description: System · Execute one approved work order, end to end
---
Enforce the stage gate before dispatching anything: refuse unless the WO
is `status: approved` — the same gate `agents/implementer.md` rule 1
states; the planner self-certified it (rule 3.2), the librarian's audit
comes afterwards or not at all, and this check stands on its own either
way — and carries no open `blocked-by` edge
touching it — §10's own definition of done requires none remain (rule
2.3 is what defines a `blocked-by` edge in the first place).

One more precondition, and it is a refusal, not a routing hint: a
`ui: yes` work order must carry a `Signed-off:` bullet with a real date
— written by the librarian off the owner's word on the published preview
page (rule 7.3, `agents/librarian.md`) — and the components.md rows that
preview registers must read `approved`, not `proposed`. Refuse without
it and name the step that clears it: `/sdlc-factory:design preview
WO-###`, then the owner's word, then here. The template's undated
`Signed-off: <date>` placeholder is not a sign-off; only a date is.
`factory-console next` refuses the same way — it points at `/design`
rather than at this verb for such a work order — so the two agree
mechanically and neither depends on this paragraph being read. The one
way past: an explicit owner ruling, recorded in the WO's own `## Log` as
`- <date> ruled — owner — <one line>` (the librarian writes it), which
waives the gate and stays visible in the file forever. *On ReachKit v3's
W2 a stand-in orchestrator dispatched the implementer for a `ui: yes`
order with no preview at all, because this gate existed only as prose
here and as a checker finding after the fact; the sheet was drawn
retroactively against the code as built.*

One more precondition: the WO, and the blueprints it implements, must be
committed on the main branch. An expand or workorder pass lands
uncommitted and the owner accepts by committing — a WO absent from HEAD
is an acceptance that has not happened yet. Refuse and say so, rather
than cutting a worktree that cannot see its own work order. *On the
first live run two worktrees had to carry their WO docs in by hand;
this clause is the cure.*

Build the context pack and hand it over as the dispatch's reading list
(rule 4.5): `factory-console pack WO-###` returns the WO, the artifacts
its own edges name, and the files its file plan names, plus the byte
count. Say **"read nothing beyond the pack unless a test fails"** in the
prompt, and write the command's own log line onto the order's `## Log`.
The pack is mechanical on purpose — an assembled-by-judgement pack is how
41M cache-read tokens happened for one order — and a failing test is the
one licence to read wider, because a failure is evidence the pack was
wrong.

Then run `factory-console impact WO-###` (Task 1's read-only query) once,
before a line changes, so the file plan can be checked against a computed
answer rather than a guess. The blueprints' `code:` anchors (rule 5.6) and
the journey step(s) whose `exercises` names one of the pack's requirements
are read only if the pack's own files do not answer the question.

Create an isolated worktree — this command's own rule, not
implementer.md's — on the WO's own branch, `wo/WO-###-slug` (the branch
name is `agents/implementer.md` rule 2; `git worktree add` is how this
command isolates it), and invoke the implementer subagent inside it. A
run that stops partway — rule 4 of that agent, or any other reason —
leaves no stray edit on whatever branch happened to be checked out
elsewhere; the worktree is disposable, the branch is not. Every `## Log`
line implementer.md already specifies (`started`/`finished`/`failed`) is
written from inside that worktree, into the WO's own file, same
convention.

On a clean finish, the implementer subagent commits inside the worktree
— the convention `agents/implementer.md` states under Style
(`type(WO-###): what moved and why`, one work order per commit, never a
range) — and then this verb closes the order itself, which is the 0.13.2
change:

1. **Run the order's own tests and its typecheck.** Both green is the
   whole per-order gate (§3) — the one thing an order can prove without
   reading the corpus. Red: the implementer gets it back, `failed —` on
   the log, and nothing merges.
2. **Merge.** The `wo/WO-###` branch goes into the wave's integration
   branch (`wave/W<n>`, cut from main when the wave opened). `main` is
   fast-forwarded to that branch once, at wave close — unchanged, and
   deliberately not per order.
3. **Stop.** No validator, no regression, no `done`. All three now run
   once per wave, over the merged result (`/wave close`). A work order
   that merges stays `approved`; `done` is set for the whole wave at
   once, by the librarian, at close.

Report the commit(s), the implementer's per-file summary, and the test,
typecheck and merge results. Run surgically,
`/implement` builds, proves, merges and stops; it never verifies its own
work against the corpus — that is what the wave pass is for.

Work order: $ARGUMENTS
