// Facts we can quote on a live page's detail (owner R7, docs/spec/decisions/2026-11-03-2127.md): the Settings read it
// always had, in a boundary of its own, so a failed or stalled read leaves only this card on the plain line.
import type React from "react";
import { Suspense } from "react";
import { CardSkeleton } from "../../_shell/skeletons";
import { readBusinessQuotable } from "../../settings/business-provider";
import { landed, Unread } from "../../settings/Unread";
import { FactsPanel } from "./FactsPanel";

export function PageFacts(): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton testId="draft-facts-skeleton" rows={0} />}>
      <Facts />
    </Suspense>
  );
}

async function Facts(): Promise<React.JSX.Element> {
  const facts = await landed(readBusinessQuotable(), "businessFacts");
  return facts === null ? <Unread testId="draft-unread-facts" /> : <FactsPanel facts={facts} />;
}
