// The business name this tab's fixed examples use: the crawl's stored name, read alone so the tab
// does not pay for Your business's whole read. `null` where none is stored or the read fails.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../../_session/account";

export const readBusinessName = cache(async function readBusinessName(): Promise<string | null> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) {
    const { FIXTURE_BUSINESS_PROFILE } = await import("../business-fixture");
    return FIXTURE_BUSINESS_PROFILE.siteName;
  }
  try {
    const { readSiteProfile } = await import("@/lib/site-profile");
    return (await readSiteProfile(account.domain))?.siteName ?? null;
  } catch {
    return null;
  }
});
