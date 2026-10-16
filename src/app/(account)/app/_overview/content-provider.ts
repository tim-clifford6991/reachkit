// SPEC §4 (owner, 2026-10-15, issue 1457) — the one read of the pages
// published, shared by Overview's Content tile and Plan's *Published* list.
//
// §9's live pages: published and not taken down — the predicate the hosted
// sitemap and Settings' count read. A read that fails is `null`, never an
// empty list: nothing read is not nothing published.
import { cache } from "react";
import { now } from "@/lib/config/now";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import type { PublishedRead } from "./content";
import { CONTENT_FIXTURE_NOW, FIXTURE_PUBLISHED } from "./content-fixture";

/** The signed-in account's pages: Overview's read. */
export const readPublished = cache(async function readPublished(): Promise<PublishedRead> {
  const account = await requireSetUpAccount();
  return readPublishedFor(isReservedFixtureAccount(account) ? null : account.siteId);
});

/** One site's pages, `null` for the reserved fixture account — the read
 *  Plan makes through its own site seam (`../calendar/provider.ts`). */
export const readPublishedFor = cache(async function readPublishedFor(siteId: string | null): Promise<PublishedRead> {
  if (siteId === null) return { pages: FIXTURE_PUBLISHED, now: CONTENT_FIXTURE_NOW };

  // Imported at the call: `content-store.ts` resolves `@/lib/db`, which
  // parses the deployment's own bindings at module load, and the reserved
  // account reaches no database.
  const { readPublishedPages } = await import("./content-store");
  return { pages: await readPublishedPages(siteId), now: now() };
});
