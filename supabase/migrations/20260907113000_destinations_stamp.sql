-- supabase/migrations/20260907113000_destinations_stamp.sql
--
-- BUILD §9 · ADR-083 Decision 4 (issue #160) — whether this destination's
-- site will carry the findability stamp, as a fact on the row rather than a
-- thing a customer discovers by following a mail to a list that is empty.
--
-- `_destinations_core.sql` gave the row `publish_capable`. This is its
-- sibling and **not its second value**: they are two questions with two
-- consequences, and a single column could not hold both. `publish_capable`
-- is the one probe result on this row that is a *health input* — false
-- makes the destination `error` / `cannot_publish` and the queue holds
-- there. This one changes no state at all: a site that publishes perfectly
-- and will not take a `post_tag` term is a **working** destination, and all
-- that is lost is REQ-060 criterion 6's list.
--
-- `structure.md` rule 3a: the bare `destinations` topic, the same way
-- `*_destinations_core.sql` is — this is that node's own column.
--
-- **Nullable, no default, and three-valued on purpose.**
--
--   · `null` for a hosted destination, which has no such question to
--     answer: ReachKit runs that end and there is no account there whose
--     permission to make a term could differ from its permission to post.
--   · `null` before the first probe, and after any probe that could not be
--     read. "We could not ask" is not "the answer is no", and a `false`
--     written from a network blip would tell a customer their posts are
--     not gathered anywhere when they are.
--   · `true` / `false` are answers, each written by a probe that got one.
--
-- A default of `false` would erase the first two of those into the third,
-- which is the whole reason there is no default.
--
-- No index: every read of this column is on a row already found by id, and
-- nothing selects destinations *by* it.

alter table destinations
  add column stamp_capable boolean null;

comment on column destinations.stamp_capable is
  'BUILD §9 · ADR-083 Decision 4 (issue #160). Whether the destination''s site carries ReachKit''s findability stamp, as the capability probe last found it. Null means not asked (hosted, or before the first probe) or could not be asked. Unlike publish_capable it is NOT a health input: false is a working destination that publishes normally and has no list to point a customer at.';
