// src/lib/scan/site-category.ts — the category the founder confirmed, as
// the paid passes read it (#767).
//
// SPEC §0: the category "fixes the twelve questions". Setup and Settings
// write it to `sites.category`; the deep and weekly passes read it here and
// hand it to `runScan`, which seeds the market on it ahead of the category
// the model inferred.
import { dbAdmin } from "@/lib/db";

/** The site's confirmed category, or `undefined` where none is stored — the
 *  pass then seeds from the profile, as it always did. A read that fails
 *  throws: the caller's job retries rather than measuring a market the
 *  founder did not confirm. */
export async function readSiteCategory(siteId: string): Promise<string | undefined> {
  const { data, error } = await dbAdmin().from("sites").select("category").eq("id", siteId).limit(1);
  if (error) throw new Error(`scan: could not read the site's category: ${error.message}`);
  const category = data?.[0]?.category?.trim();
  return category === undefined || category === "" ? undefined : category;
}
