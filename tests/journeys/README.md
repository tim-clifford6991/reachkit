# Journey tests — the user journey map, as code

One file per arrow in `SPEC.md` §3. Each runs the whole path end to end with
vendor calls mocked at the cost seam (`tests/setup.ts` refuses real network).
A hole in a journey is a **red or missing file here**, visible on every PR;
`scripts/drift-audit.mjs` lists a stub (`describe.todo`) as `TODO` and a
missing file as `MISSING`. Replace the stub the moment the path exists.

| File | Arrow | Journey |
|---|---|---|
| 01-landing-to-report | `/` → `/scan/{domain}`, scanning → rendered report | JN-001 steps 1–8, JN-006 |
| 02-report-to-lead | "Email me the full page" → lead → first-page mail → nurture | JN-001 steps 9–10 |
| 03-report-to-paid | Start → Stripe Checkout → webhook → magic link → `/setup` | JN-002 steps 1–2 |
| 04-setup-to-first-draft | three decisions → deep pass → first draft in the calendar | JN-002 steps 3–9 |
| 05-daily-loop | draft-ready mail → veto window → publish → +24h verify | JN-003 |
| 06-monday | Monday re-measure → movement mail → page verdicts | JN-005 |
| 07-account-and-leaving | settings changes → billing portal → export → unpublish / delete | JN-004 |

The original journey narratives are in
`archive/sdlc-factory-2026-09-04/corpus/docs/journeys/`.
