-- supabase/migrations/20261011120000_fetches_billed_cents.sql
--
-- Issue 1408 · SPEC §6 (owner, 2026-10-11) — record what the vendor billed.
--
-- `cost_cents` is the product's own figure: the price book's estimate, or a
-- settlement worked out from it. The audit of 2026-10-11 found it 1.7 times
-- what DataForSEO charged for the same day. `billed_cents` is the vendor's
-- own charge for the call, read from its response (`task.cost`, US dollars,
-- stored as US cents like `cost_cents`).
--
-- Null where the response carried no charge: every row from before this
-- shipped, every model call (Anthropic reports tokens, not money, on a
-- response), every read of a customer's own page, and a vendor call that
-- timed out. A null is never read as zero.
--
-- Nothing that decides whether to call reads this column. The caps and the
-- reservations stay on `reserved_cents` and `cost_cents`.
--
-- Additive and nullable. The product runs before this is applied:
-- `src/lib/costs/ledger.ts` writes the row without the column when the
-- database does not have it yet.

alter table public.fetches add column if not exists billed_cents numeric(12,4);

comment on column public.fetches.billed_cents is
  'Issue 1408. What the vendor says it charged for this call, in US cents, read from its response. Null where the response carried no charge; never an estimate. cost_cents is the price-book figure the caps use.';
