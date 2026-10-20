---
name: weekly-review
description: ReachKit's one scheduled weekly review (PROCESS.md › Never, C7). Reads code, CI and production read-only through five lenses (bloat, production health, SEO, dependencies, flaky tests), classifies each finding under Coherence, files at most five unready issues, and republishes the pinned "ReachKit this week" page. Use when the rk-weekly timer starts a run, or when asked for the weekly review or its dry run.
---

# Weekly review

One run a week. It reads, it classifies, it files at most five issues, it republishes one page. Then it stops.

## Rules (each one ends the run if it would be broken)

- **Read-only.** Never edit, commit, push, merge or deploy. Never run a migration, `redeploy.sh`, `smoke.sh`, or a command that writes to production. The only file written is under `.review/weekly/` (ignored by git).
- **0¢.** No paid vendor or model API call. Never run `npm run panel` (other than `--recheck`), `scripts/page.mjs`, `pass.mjs`, `free-scan.mjs`, `eval-content.mjs`, `d19-cost.mjs`, `market-inference.mjs`, or `npm run costs` without `--stored`. Do not use DataForSEO, Anthropic, Resend or Stripe. The run's own model use is the box's Claude subscription; `ANTHROPIC_API_KEY` is unset by the wrapper (README).
- **At most five issues**, every one labelled `from-weekly` and none Ready. The orchestrator classifies them; this run never starts an engineer.
- **Not measured is never shown as 0.** A source that cannot be read is written as not read, with why.
- **Every customer.** A finding is a general condition that holds for SaaS and local sites alike, never a tune for reachkit.app.

## Modes

- `dry-run` (the argument): do every read, write the report and the page to `.review/weekly/`, and run no `gh issue create`, `comment`, `edit`, `pin` or `label` command. The report lists what a live run would file. The wrapper gives a dry run no tool that writes to GitHub.
- live (the timer): as above, then file, comment and republish.

Read `date -u +%F` (DAY) and `date -u -d '7 days ago' +%F` (SINCE) once and write both as literal dates in every later command: the wrapper allows each command only exactly as this page writes it, with no other option, shell expansion or redirection. Write files with the Write tool. Work from `/root/projects/reachkitv3` after `git fetch -q origin`; read `origin/main`, never change the checkout.

## 1. Five lenses

Run the commands in the table yourself, one plain command each, then give each lens's output to a subagent of the expert agent named, in parallel; subagents read with Read, Grep, Glob and WebFetch only. Each returns at most three findings, each with: what, evidence (command and output line), the surface (`scan`, `content`, `app`, `public`, `jobs`, `mail`, `db` or none), and the smallest change that fixes it.

| Lens | Agent | Reads |
|---|---|---|
| Bloat (budgets) | `architect` | The budget lines `node scripts/hygiene.mjs` prints, where it has them. `git ls-files src \| xargs wc -l \| sort -n \| tail -21`. `npm run orphans`. Comment lines against code lines and test lines against src lines per top-level `src/lib/*` directory. A helper a library on `docs/DESIGN.md`'s list already provides. Output in the form "library X does this; delete Y and its test" (CLAUDE.md, nothing is kept because a test protects it). |
| Production health | `operations` | `curl -fsS https://reachkit.app/api/health` (a GET). `npm run costs -- --stored`. Open issues titled `[hygiene]`, `[nightly]` or `[layout]`. The Supabase and Vercel connectors are not given to the run (a permission rule cannot hold SQL to `SELECT`), so `job_runs`, stalled sites and runtime errors are written as not read. |
| SEO | `seo-master` | The live hosted pages (plain GETs) and the stored rows and decisions it already reads, in its own ranked-conditions format. No DataForSEO and no paid tool. |
| Dependencies | `architect` | `npm outdated --json` and `npm audit --omit=dev --json`. One grouped upgrade finding on the first Monday of a month only; Next.js is excluded (its upgrade is its own issue). |
| Flaky tests | `architect` | CI history: `gh api 'repos/tim-clifford6991/reachkit/actions/runs?per_page=100' --jq '.workflow_runs[] \| select(.created_at >= "SINCE" and .run_attempt > 1 and .conclusion == "success") \| [.name, .head_sha, .html_url] \| @tsv'` (a job that failed and passed on the same SHA), and open issues whose title starts `Flaky` or `[flaky]`. A root-cause note on the oldest. |

## 2. Classify under Coherence first

`docs/PROCESS.md` › Coherence decides where each finding goes, in this order:

1. **Already filed?** `gh issue list --state open --search "<key words>"`. If an open issue covers it, it is a comment on that issue, not a new one.
2. **An example of a registry parent** (#1454 scan, #1127 content, #1457 app, #1458 public): a comment on that parent. Never a new issue, never `Closes`.
3. **A word, a label or a screen** against the strategy in `docs/DESIGN.md`: an issue that extends `tests/ui/design/strategy.test.ts` or the layout gate.
4. **A new condition**: an issue with Conditions, Invariants, Surfaces and Overlaps filled.
5. **A production failure on the paying path**: an issue labelled `P0`.

Rank the issues by harm to a paying customer, then by lines removed. Keep the top five. The rest go in the report only.

Issue body:

```markdown
**From the weekly review, <DAY>.** Not Ready: the orchestrator classifies it.

## Conditions
1. <what is true afterwards>. **Fails →** <the check that fails when it breaks>.

## Invariants
- 0¢. Never tuned to reachkit.app. Not measured is never shown as 0.

## Surfaces
<surface or none>

## Overlaps
<open issues and PRs read against, the SPEC section, what was left alone>

## Evidence
<command and the output line>
```

Live: `gh label create from-weekly --color BFD4F2 --description "Filed by the weekly review" 2>/dev/null || true`, then `gh issue create --label from-weekly --title "<plain sentence>" --body-file <file>`, and `gh issue comment` for the comments.

## 3. Republish "ReachKit this week"

`node scripts/this-week.mjs`, and write its output with the Write tool to `.review/weekly/this-week-DAY.md`.

Run it after filing, so Found holds this week's issues. Live: the page is the pinned issue titled `ReachKit this week`. Find it with `gh issue list --state open --search '"ReachKit this week" in:title' --json number`; if there is none, `gh issue create --title "ReachKit this week" --body-file …` and `gh issue pin <n>`. Otherwise `gh issue edit <n> --body-file .review/weekly/this-week-DAY.md`. It is the only issue the run edits.

## 4. Report

Write `.review/weekly/DAY.md`: the mode, each lens's findings with evidence (or "not read: why"), the classification of each, what was filed or commented (live) or would be (dry run), and what was left out over the cap. Print its path and stop.
