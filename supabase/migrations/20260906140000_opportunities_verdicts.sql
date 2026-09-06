-- BUILD §9, §10 — `page_verdicts`: one row per published page per week,
-- inserted once and never rewritten.
--
-- §9: "Monday → full re-measure; each published page gets Working / Too
-- early / Not working against its acceptance test." REQ-063 adds the
-- fourth standing — no longer judgeable — and the law this table is shaped
-- by (DECISIONS 2026-09-01, ADR-071/072): a page has four ways of having
-- no ordinary verdict, none may be merged, and all four are terminal.
--
-- **Two of the four have no row shape here, and that is the point.** A
-- week that was not measured at all (`no_week`) and a page a partly
-- measured week could not decide (`not_measured`) are represented by the
-- *absence* of a row. There is nowhere to write them, so a transient miss
-- cannot be written down as a permanent state — which is what a
-- `not_judgeable` row is (ADR-071 point 2).
--
-- **Insert-only is a permission, not a convention.** No update and no
-- delete is granted on this table to any role the request path holds, so a
-- later week cannot rewrite an earlier verdict. The series is the record
-- REQ-063 c6's "the date of the last verdict it did receive" is read from,
-- and it is also what makes terminality readable: `judgeWeek` asks for a
-- prior `not_judgeable` row before it evaluates anything, and there is no
-- writer anywhere that could clear one (ADR-072 decision 5c — no
-- `is_judgeable` column exists here, precisely because a flag would need a
-- writer that clears it).
--
-- **No `publications.verdict` column** — BUILD §10 names one and BP-051
-- decision 1 rules it out; the baseline (`00000000000001_baseline.sql`)
-- already leaves it off, with that reason in a comment. A column holding
-- one latest verdict would be a second copy of this table's head row and
-- could not answer c6's "the date of the last verdict it did receive". A
-- migration elsewhere that adds it is a conflict to report, not to work
-- around.
--
-- Topic token `opportunities`, sub-token `opportunities_verdicts`
-- (`src/lib/db/topics.ts`).

create table page_verdicts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications (id),
  -- Carried beside the publication rather than joined for it: every read
  -- this table serves is "one site, one week", and the weekly job judges
  -- per site. RLS scopes on it too.
  site_id uuid not null references sites (id),
  -- The **site-local Monday**, as a calendar date. Never an instant and
  -- never recomputed on read: a customer who moves time zone moves no
  -- verdict they have already been given (ADR-060; `scans.week_start`
  -- carries the same fact for the measurement this verdict was taken
  -- from).
  week_start date not null,
  verdict text not null check (verdict in ('working', 'too_early', 'not_working', 'not_judgeable')),
  -- One of REQ-063 c6's five causes, and only ever on the fourth verdict.
  -- Stated as a biconditional in both directions: a `not_judgeable` row
  -- with no cause could not carry c6's written line, and a `working` row
  -- with a cause would be a page judged and retired at once.
  cause text null check (
    cause is null
    or cause in ('search_untracked', 'unpublished', 'page_not_found', 'question_left_set', 'domain_changed')
  ),
  constraint page_verdicts_cause_iff_not_judgeable check ((verdict = 'not_judgeable') = (cause is not null)),
  -- The date the measurement behind this verdict was taken — the report's
  -- own, not this row's. Null on a `not_judgeable` row: nothing was
  -- measured for it, and a date there would be the storage's rather than
  -- the measurement's.
  measured_at timestamptz null,
  -- The weekly scan this verdict was read from, so a verdict can always be
  -- traced back to the measurement that produced it.
  scan_id uuid null references scans (id),
  -- The value the recorded test was decided from — a `Measured<number>`
  -- blob, or null where the test's form yields no number (`named_on`,
  -- `gate_cleared`). Next week's movement is computed against this, which
  -- is REQ-063 c3's "the previous re-measurement": the figure itself is
  -- kept so a decline is compared with what was actually recorded and
  -- never re-derived from a report that has since moved.
  measured jsonb null,
  -- The composed `Movement | null` — previous week, span, both raw values,
  -- and whether it declined. Written at insert and read back as it stands:
  -- REQ-063 c3's decline is never re-derived on the render path, where it
  -- could be rounded away.
  movement jsonb null,
  created_at timestamptz not null default now()
);

alter table page_verdicts enable row level security;

-- Idempotency is this key, not a guard in application code: `judgeWeek`
-- runs on an at-least-once weekly tick, and a second run for a week it has
-- already judged is refused here rather than read-then-written around.
create unique index page_verdicts_one_per_page_per_week
  on page_verdicts (publication_id, week_start);

-- The two reads: one site's week (`readWeek`, the digest, the surfaces),
-- and one publication's history (`lastJudgedWeek`, the previous
-- measurement, the terminality short-circuit).
create index page_verdicts_site_week_idx on page_verdicts (site_id, week_start);
create index page_verdicts_publication_idx on page_verdicts (publication_id, week_start desc);

-- Read-only for the owning site's user, like `publications` beside it;
-- written by the weekly judgement through `dbAdmin()`, which runs inside a
-- job and has no `auth.uid()` for a row policy to match.
create policy page_verdicts_select_own on page_verdicts for select to authenticated
  using (
    site_id in (
      select s.id from sites s
      join users u on u.id = s.user_id
      where u.id = auth.uid() and u.deleted_at is null
    )
  );

-- **The insert-only permission.** `select` and `insert` and nothing else:
-- no role the product holds may update or delete a verdict, so the history
-- c6 reads cannot be rewritten by a later week — and no code path exists,
-- anywhere, that could clear a `not_judgeable` cause (ADR-072 decision 5c).
grant select on page_verdicts to anon, authenticated, service_role;
grant insert on page_verdicts to service_role;
