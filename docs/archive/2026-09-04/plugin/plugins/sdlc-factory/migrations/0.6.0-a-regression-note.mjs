// Doctrine 0.6.0 — the `Regression:` line, and `tst-without-regression`.
//
// Tasks 2-3 of this wave added a new line to the grammar a validator writes
// into a work order's latest TST section — `Regression: <n> files · <REQ
// list | none> re-checked — pass` (or `— findings: …`) — and a warn-severity
// checker rule, `tst-without-regression`, that flags a `done` work order
// whose latest TST section lacks one. This migration is that grammar
// change's version marker (the doctrine rule this repo's own CLAUDE.md
// states: a grammar change is the template/skill edit, this migration, and
// the plugin.json bump, together in one commit).
//
// It is a *stated* no-op. `/regress` writes the line going forward, on
// TST sections the validator itself produces from a live run against a live
// worktree — a real regression check with a real result. A work order that
// was marked `done` before this doctrine version exists has no such run to
// report: there is no file on disk this migration could read a file count,
// a re-checked requirement list, or a pass/findings verdict out of. Writing
// a `Regression:` line for one anyway would not record history, it would
// invent it — exactly the kind of fabrication CLAUDE.md's parser-invariants
// section warns against for ellipsis ranges, and the same posture every
// migration in this set already takes (0.4.0-a and 0.5.0-a refuse to invent
// a journey or a log entry no owner ever wrote).
//
// So this migration rewrites nothing, on any corpus, ever. Its only effect
// is the version stamp `factory upgrade` writes after it runs, and the one
// log line below. A `done` work order that predates 0.6.0 and has no
// `Regression:` line stays exactly as `tst-without-regression` already
// finds it — reported, not silently backfilled — until a real `/regress`
// run (or a human) puts a real line there.
//
// Refuses to guess, always:
//   - every existing work order, front-matter or head-block, done or not,
//     with or without a TST section — none is read, none is written.

export const version = "0.6.0";
export const describe = () => "regression is recorded going forward; history is not rewritten";

export async function migrate(ctx) {
  ctx.log(
    "  Regression: lines are authored going forward by /regress — no past validation report is rewritten"
  );
}
