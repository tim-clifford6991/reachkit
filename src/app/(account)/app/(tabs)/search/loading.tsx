// SPEC §4 (plate O4) — On Google's detail while its read is in flight: the tiles, the head, then the pages' card.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CardSkeleton } from "../../_shell/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTilesSkeleton } from "../../_overview/Tiles";

export default function SearchLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="search-waiting">
      <DetailTilesSkeleton />
      <TabHead title={copy("overview.google.title")} testId="search" lead={copy("overview.google.lead")} measured={null} />
      <CardSkeleton testId="google-pages-skeleton" rows={6} />
    </div>
  );
}
