-- handle_new_user() is an auth-trigger helper (SECURITY DEFINER). It must not
-- be callable via PostgREST RPC by anon/authenticated (Supabase advisor WARN,
-- launch review 2026-07-15). PUBLIC must be revoked too: Postgres default-
-- grants EXECUTE on functions to PUBLIC, and anon/authenticated inherit from
-- it — revoking only the two named roles leaves the function callable
-- (verified locally: PUBLIC kept EXECUTE after the narrower revoke). The auth
-- trigger is unaffected: trigger fire-time performs no EXECUTE check on the
-- inserting role, and the function is SECURITY DEFINER (owner context).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
