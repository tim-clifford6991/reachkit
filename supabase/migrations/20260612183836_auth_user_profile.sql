-- Trigger: create public.users row when an auth user signs up.
-- This is the id = auth.uid() contract: the public.users row gets the SAME id
-- as the auth.users row so that RLS policies (id = auth.uid()) resolve correctly.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Record the email that claimed this scan (pending claim before auth is confirmed).
alter table scans add column claim_email text;