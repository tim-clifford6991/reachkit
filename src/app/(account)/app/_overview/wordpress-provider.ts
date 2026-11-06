// Whether the Overview draws its WordPress connect arm: the site's only destination is a WordPress never connected.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

export const readWordPressWaiting = cache(async function readWordPressWaiting(): Promise<boolean> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return false;
  const { destinationWaitingOnWordPress } = await import("@/lib/publish/destinations");
  // A read that fails draws the ordinary Overview, never a connect ask nobody can justify.
  return destinationWaitingOnWordPress(account.siteId).catch(() => false);
});
