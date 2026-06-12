-- Enable RLS on every public table (a table without RLS is open to the anon key).
alter table apps enable row level security;
alter table users enable row level security;
alter table scans enable row level security;
alter table evidence enable row level security;
alter table findings enable row level security;
alter table actions enable row level security;
alter table competitors enable row level security;
alter table monitors enable row level security;
alter table score_snapshots enable row level security;
alter table outcomes enable row level security;
alter table raw_documents enable row level security;
alter table fact_sheets enable row level security;
alter table pipeline_runs enable row level security;
alter table embeddings enable row level security;

-- Owner-scoped SELECT policies for the customer-facing tables.
-- A user owns an app when its id is in users.app_ids.
create policy "owner reads own user row" on users for select
  using (id = (select auth.uid()));

create policy "owner reads apps" on apps for select
  using (exists (select 1 from users u
    where u.id = (select auth.uid()) and apps.id = any (u.app_ids)));

create policy "owner reads scans" on scans for select
  using (exists (select 1 from users u
    where u.id = (select auth.uid()) and scans.app_id = any (u.app_ids)));

create policy "owner reads actions" on actions for select
  using (exists (select 1 from users u
    where u.id = (select auth.uid()) and actions.app_id = any (u.app_ids)));

create policy "owner reads findings" on findings for select
  using (exists (select 1 from scans s, users u
    where u.id = (select auth.uid()) and s.id = findings.scan_id and s.app_id = any (u.app_ids)));

-- competitors, monitors, score_snapshots, outcomes, raw_documents, fact_sheets,
-- pipeline_runs, embeddings: RLS enabled, NO policy => service-role only.
-- Owner-read policies for the app-scoped ones are added when the dashboard surfaces them (Cycle 3/4).
