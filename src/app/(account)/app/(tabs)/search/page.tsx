// SPEC §4 (2026-09-20, #908) — the Search tab's address.
//
// "Search tab: every search ReachKit is going after — searches a month,
// difficulty against the site's ceiling, the site's position and change, the
// best rival and its position, and status." That screen is #916. This file
// is its address, so the tab bar and the Overview's first tile both have
// somewhere to go from the day they land.
import type React from "react";
import { TabPlaceholder } from "../../_overview/TabPlaceholder";

export default function SearchTabPage(): React.JSX.Element {
  return <TabPlaceholder tab="search" />;
}
