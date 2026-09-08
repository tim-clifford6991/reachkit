// BUILD §3, §4.5, UI-SPEC S1 section 02 — the live This-week card.
// src/app/(public)/_landing/WeekCard.tsx
//
// **Section 02's picture of what the product does for them**: the
// Overview's own This-week card — the week strip, and beneath it the panel
// that names the page publishing next. The approved set draws it beside the
// what-it-does heading, with the card first in the source order so it sits
// on the *left* at the two-column band and the reading alternates against
// section 01.
//
// **The panel carries no CTA here, and that is the set's own drawing.**
// On the Overview the same panel offers "Read it"; on the landing it is a
// specimen shown to a stranger with no account to act in, and a solid
// accent CTA they cannot use would also be a third solid on a page ruling
// 2b gives exactly two. `ActionPanel`'s `specimen` arm is that case, added
// with this issue and refused everywhere an action is actually being asked
// for.
//
// The week's shape is `specimen.ts`'s, which states why it draws three of
// the strip's four day states.
import type React from "react";
import { Calendar, FileText } from "lucide-react";
import { WeekStrip } from "@/ui/charts";
import { Badge } from "@/ui/components/Badge";
import { Divider } from "@/ui/components/Divider";
import { ActionPanel, CardHead, IdiomCard } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { specimenWeek } from "./specimen";

/** Bound to a name before it reaches JSX: the copy sweep reads every
 *  JSX attribute as product voice unless it is allow-listed, and it is
 *  right to. */
const WEEK_TEST_ID = "landing-week";

export function WeekCard(): React.JSX.Element {
  return (
    <IdiomCard
      testId={WEEK_TEST_ID}
      head={
        <CardHead
          icon={<Calendar size={15} strokeWidth={1.8} aria-hidden />}
          eyebrow={copy("overview.week.title")}
          pill={<Badge tone="ok">{copy("landing.week.badge")}</Badge>}
        />
      }
    >
      <WeekStrip days={specimenWeek()} label={copy("overview.week.title")} />
      <Divider />
      <ActionPanel
        state="specimen"
        tone="accent"
        icon={<FileText size={14} strokeWidth={1.8} aria-hidden />}
        title={copy("landing.week.page.title")}
        line={copy("landing.week.page.line")}
      />
    </IdiomCard>
  );
}
