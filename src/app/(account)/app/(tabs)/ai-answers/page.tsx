// SPEC §4 · §6 (2026-09-20, #908) — the AI answers tab's address.
//
// "AI answers tab: see §6 of this date for the measures" — the rolling
// four-week rate beside this week's n of 12, the tracked questions, and the
// engines that named the site. That screen is #918. This file is its
// address, so the tab bar and the Overview's second tile both have somewhere
// to go from the day they land.
import type React from "react";
import { TabPlaceholder } from "../../_overview/TabPlaceholder";

export default function AiAnswersTabPage(): React.JSX.Element {
  return <TabPlaceholder tab="ai_answers" />;
}
