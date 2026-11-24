// Facts we can quote on a live page's detail (`docs/SPEC.md §4 Your business`): the Settings read it
// always had, in a boundary of its own, so a failed read leaves only this card on the error line.
import type React from "react";
import { Suspense } from "react";
import { CardSkeleton } from "../../_shell/skeletons";
import { Part } from "../../_shell/Part";
import { readBusinessQuotable } from "../../settings/business-provider";
import { recorded } from "@/lib/ops/events";
import { FactsPanel } from "./FactsPanel";

export function PageFacts(): React.JSX.Element {
  return (
    <Part testId="draft-facts-failed">
      <Suspense fallback={<CardSkeleton testId="draft-facts-skeleton" rows={0} />}>
        <Facts />
      </Suspense>
    </Part>
  );
}

async function Facts(): Promise<React.JSX.Element> {
  return <FactsPanel facts={await recorded(readBusinessQuotable(), "businessFacts")} />;
}
