// Issue 1454 — what ReachKit read of the signed-in customer's business,
// for Overview's *What we read* card. One request-cached read through the
// shared reader (`src/lib/business/read.ts`), so Overview, the free report
// and Settings say the same thing. The reserved fixture account reaches no
// database.
import { cache } from "react";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

const FIXTURE_UNDERSTANDING: BusinessUnderstanding = {
  name: "Example",
  job: "write and publish pages that buyers find",
  sells: [
    { name: "Autopilot", category: "AI content marketing software", weight: 0.7 },
    { name: "Free scan", category: "AI visibility checker", weight: 0.3 },
  ],
  buyers: ["small business owners", "B2B software companies"],
  where: { reach: "international", place: null, country: "US" },
  kind: "software",
  language: "en",
};

export const readUnderstanding = cache(async function readUnderstanding(): Promise<BusinessUnderstanding> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_UNDERSTANDING;
  // Imported at the call: it reaches `@/lib/db`.
  const { readBusinessUnderstanding } = await import("@/lib/business/read");
  return readBusinessUnderstanding({ siteId: account.siteId, domain: account.domain });
});
