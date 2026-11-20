// The category the founder confirmed, which "fixes the twelve questions": setup and Settings write `sites.category`, the paid passes read it here
// and `runScan` seeds the market on it ahead of the inferred category.
import { dbAdmin } from "@/lib/db";

/** The site's confirmed category, or `undefined` where none is stored (the pass seeds from the profile). A failed read throws: the job retries
 *  rather than measuring a market the founder did not confirm. */
export async function readSiteCategory(siteId: string): Promise<string | undefined> {
  const { data, error } = await dbAdmin().from("sites").select("category").eq("id", siteId).limit(1);
  if (error) throw new Error(`scan: could not read the site's category: ${error.message}`);
  const category = data?.[0]?.category?.trim();
  return category === undefined || category === "" ? undefined : category;
}
