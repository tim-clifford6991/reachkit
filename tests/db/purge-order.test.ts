// The account purge cannot stop half way: every table referring to a table it empties is emptied first.
import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { psql, psqlRows } from "./substrate";
applyEnvFixture();
const { PURGE_ORDER } = await import("@/lib/account/lifecycle/purge");
const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
beforeAll(() => {
  psql(["-c", "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;"]);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});
it("every table referring to a purged table is purged before it", () => {
  const at = (table = ""): number => PURGE_ORDER.findIndex((step) => step.table === table);
  const exempt = [
    // The free report a site was bought from belongs to no site, so the purge never deletes that scan.
    "sites_provisioned_from_scan_id_fkey",
    // The purge clears the links from scans outside the account; its own scans go in one statement by site.
    "scans_supersedes_scan_id_fkey", "scans_remeasure_of_fkey",
    // A merge names a page of the same site, and one statement deletes all of a site's pages.
    "publications_merged_into_fkey",
  ];
  const refs = psqlRows(`select conrelid::regclass::text, confrelid::regclass::text from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace and conname not in ('${exempt.join("','")}');`);
  expect(refs.filter(([child, parent]) => at(parent) >= 0 && !(at(child) >= 0 && at(child) < at(parent)))).toEqual([]);
});
