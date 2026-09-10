-- supabase/migrations/20260910090000_fetches_money.sql
--
-- §6.5, issue #449 — the ledger's unit of money, corrected. No new column,
-- no new row, no behaviour change to anything but the precision two
-- existing columns hold.
--
-- **The defect.** `fetches.cost_cents` and `fetches.reserved_cents` were
-- created `integer` (`20260903080000_fetches.sql`) while the price book
-- carries sub-cent prices — `SERP_STD_C` is 0.06¢, `AI_MODE_STD_C` 0.06¢,
-- an LLM charge is cents-per-token and lands on figures like 1.12928.
-- PostgREST sends what the seam computes, so every paid vendor row failed
-- to insert with `invalid input syntax for type integer: "1.12928"`, the
-- stage that owned it was marked undeterminable, and the report shipped
-- `degraded` with `score null` and `cost_cents 0`. Only the two free
-- `egress.safeFetch` rows (0¢, an integer) ever landed — which is why no
-- production scan has produced a measured score.
--
-- **The unit: cents, with four decimal places (`numeric(12,4)`).** The
-- alternative the issue names — integer micro-cents in a renamed column —
-- was not taken. The whole product already speaks cents and nothing else
-- does: `DATA-COSTS`'s price book, `CAPS` (`FREE_C` 12, `DEEP_C` 150,
-- `WEEKLY_C` 40, `DRAFT_C` 45, `DAILY_PRODUCT_C` 5000), every vendor's
-- `costCents`, every signature across `src/lib/costs/`. Rescaling that to
-- micro-cents would rename and multiply every one of those constants and
-- every arithmetic site that reads them, in a file a feature PR may not
-- edit (`src/lib/config/`), to buy nothing this does not already give:
--
--   * `numeric` is **exact decimal** arithmetic in the database, so
--     `sum()` over a day of 0.06¢ rows is 0.06¢ × n and not a binary-float
--     drift of it — the property the micro-cent integer was wanted for.
--   * **scale 4 is 1/10,000 of a cent.** The finest figure the product
--     computes is a per-token LLM charge; the smallest price in the book
--     is 0.06¢. Four places hold every one of them with three orders of
--     magnitude to spare, and the rounding a fifth place would carry is
--     one hundred-thousandth of a cent per call.
--   * **precision 12 is 99,999,999.9999¢** — about a million dollars
--     against a daily ceiling of 5,000¢.
--   * the unit stays *cents*, so `CAPS` already compares in the stored
--     unit: nothing in `constants.ts` changes, and a figure read back out
--     of this column is directly comparable with the cap that authorised
--     it.
--
-- `reserved_cents` moves with `cost_cents` and for the same reason: the
-- two figures belong to the same call and the insert writes both, so a
-- reservation of 0.06¢ fails the row exactly as the settlement does. They
-- are one unit or the ledger has none.
--
-- **Idempotent.** `alter column ... type numeric(12,4)` against a column
-- that is already `numeric(12,4)` is accepted and rewrites nothing, so
-- re-running this file is a no-op; `drop function if exists` carries its
-- own guard. `integer` → `numeric` is an implicit, lossless cast, so no
-- `using` clause is needed and no existing row changes value: the rows on
-- production today are the free 0¢ ones, which become 0.0000.
--
-- `fetches_spend_since()` (#427, `20260909200000_fetches_daily_spend.sql`)
-- follows the same unit. It summed into `bigint`, which would truncate the
-- day's sub-cent total back to the defect this file removes — a day of
-- twelve-SERP free scans would read 0¢ however many ran. Its return type
-- cannot be changed by `create or replace`, so it is dropped and
-- recreated, keeping every other property it had: `stable`, `security
-- invoker`, the pinned empty `search_path`, the schema-qualified table,
-- `coalesce(..., 0)` for an empty day, and `service_role`-only execute.
--
-- `structure.md` rule 3: this file carries the `fetches` topic token
-- (`src/lib/db/topics.ts`, owner BP-007); `money` narrows it and is not a
-- second topic. The `scans` and `drafts` roll-ups of the same figure are
-- their own topics' files, landing beside this one.

alter table fetches alter column cost_cents type numeric(12,4);
alter table fetches alter column reserved_cents type numeric(12,4);

drop function if exists fetches_spend_since(timestamptz);

create or replace function fetches_spend_since(p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(f.cost_cents), 0)::numeric(12,4)
  from public.fetches f
  where f.created_at >= p_since;
$$;

revoke all on function fetches_spend_since(timestamptz) from public;
revoke all on function fetches_spend_since(timestamptz) from anon;
revoke all on function fetches_spend_since(timestamptz) from authenticated;
grant execute on function fetches_spend_since(timestamptz) to service_role;
