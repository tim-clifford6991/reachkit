-- supabase/migrations/20261016120000_sites_content_known_grants.sql
--
-- Issue 1472 — `known_content_near` is `security definer`, so it reads
-- `known_content` past RLS. Its migration (20260921150000_sites_content_known)
-- granted `execute` to `service_role` but never revoked the `execute` every
-- new function gives `PUBLIC`, nor the one Supabase's default privileges give
-- `anon` and `authenticated`. Anyone holding the publishable key could call
-- `/rest/v1/rpc/known_content_near` with any site's id and read that site's
-- rows. The security advisor named it as
-- `anon_security_definer_function_executable` and
-- `authenticated_security_definer_function_executable`.
--
-- The only caller is `nearKnownContent` in src/lib/known-content/store.ts,
-- through `dbAdmin()` (`service_role`), which keeps its grant. This is the
-- same revoke-then-grant the other service-only functions carry
-- (`fetches_spend_since`, `record_publication_read`, `rescore_scan`).
-- `tests/db/functions-search-path.test.ts` now fails a `security definer`
-- function that `anon` or `authenticated` can still execute.
--
-- Not applied by the PR that adds it; applied after merge through the
-- Supabase connector (docs/PROCESS.md step 4).

revoke all on function known_content_near(uuid, text, int) from public;
revoke all on function known_content_near(uuid, text, int) from anon;
revoke all on function known_content_near(uuid, text, int) from authenticated;
grant execute on function known_content_near(uuid, text, int) to service_role;
