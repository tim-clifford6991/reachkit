// Board Plan — the head: which week of service this is, how many pages it
// holds, and the day it was chosen. One function for the loaded screen and
// its waiting state, so the two are one shape (issue 1484).
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Box } from "../_shell/skeletons";
import { formatCount } from "../_shell/format";
import { longDate } from "./dates";
import type { PlanHeadFacts } from "./provider";

export interface PlanHeadWords {
  eyebrow: string;
  title: string;
  lead: string;
}

/** The head's three lines from the week's facts and its page count. */
export function planHeadWords(
  facts: PlanHeadFacts,
  pages: number,
): PlanHeadWords {
  return {
    eyebrow:
      facts.week === null
        ? copy("shell.nav.plan")
        : copy("calendar.eyebrow", { n: formatCount(facts.week) }),
    title:
      pages === 0
        ? copy("calendar.title.none")
        : pages === 1
          ? copy("calendar.title.one")
          : copy("calendar.title", { n: formatCount(pages) }),
    // Before the first commit there is no week to date, and nothing on it yet.
    lead:
      facts.chosen !== null
        ? copy("calendar.head", { date: longDate(facts.chosen) })
        : pages === 0
          ? copy("calendar.first-week")
          : copy("calendar.head.undated"),
  };
}

/** `null` draws the waiting state: the name, then boxes for the two lines read from the week. */
export function PlanHead(p: {
  words: PlanHeadWords | null;
}): React.JSX.Element {
  const w = p.words;
  return (
    <header className="flex min-w-0 flex-col gap-1" data-testid="plan-head">
      {/* The screen's name needs no read, so the waiting state already says it. */}
      <span className="eyebrow">{w === null ? copy("shell.nav.plan") : w.eyebrow}</span>
      {w === null ? (
        <Box className="h-8 w-60 max-w-full" />
      ) : (
        <h1 className="text-2xl font-semibold">{w.title}</h1>
      )}
      {w === null ? (
        <Box className="h-5 w-96 max-w-full" />
      ) : (
        <p className="min-w-0 wrap-anywhere">{w.lead}</p>
      )}
    </header>
  );
}
