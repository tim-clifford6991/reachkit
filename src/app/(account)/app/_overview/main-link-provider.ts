// SPEC §7 (2026-10-18, issue 1511) — whether the signed-in customer's main
// site links their articles, for Overview's optional finding. One
// request-cached stored read (`mainSiteLinkFinding`); nothing is measured for
// the screen. The reserved fixture account reaches no database and shows the
// finding, so the layout gate measures it.
import { cache } from "react";
import type { MainSiteLinkFinding } from "@/lib/site-profile/main-site-row";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

const FIXTURE_HOST = "content.example.com";
const FIXTURE_FINDING: MainSiteLinkFinding = {
  state: "not_linked",
  host: FIXTURE_HOST,
  snippet: `<a href="https://${FIXTURE_HOST}/">Articles</a>`,
};

export const readMainSiteLink = cache(async function readMainSiteLink(): Promise<MainSiteLinkFinding | null> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_FINDING;
  // Imported at the call: it reaches `@/lib/db`.
  const { mainSiteLinkFinding } = await import("@/lib/publish/destinations/hosted/main-link");
  return mainSiteLinkFinding({ siteId: account.siteId, domain: account.domain });
});
