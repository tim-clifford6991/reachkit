// Issue 1539 — what the newest pass's AI answers state of the signed-in
// customer's business that their own site contradicts, for Overview's
// finding. One request-cached stored read (`readMisstatedFacts`); nothing is
// measured or asked for the screen. The reserved fixture account reaches no
// database and shows one finding, so the layout gate measures it.
import { cache } from "react";
import type { MisstatedFact } from "@/lib/market/prompts/misstated-types";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";

const FIXTURE_FINDINGS: MisstatedFact[] = [
  {
    kind: "price",
    aiSays: "€29",
    answer: "Example plans start from €29 a month, with a free trial for new teams.",
    siteSays: "€49 a month, VAT included",
    url: "https://example.com/pricing",
  },
];

export const readMisstated = cache(async function readMisstated(): Promise<MisstatedFact[]> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return FIXTURE_FINDINGS;
  // Imported at the call: it reaches `@/lib/db`.
  const { readMisstatedFacts } = await import("@/lib/market/prompts/store");
  return readMisstatedFacts({ siteId: account.siteId, domain: account.domain });
});
