// The fixture week with every arm the screen can draw: ReachKit stopped, supply used up, and Sunday left empty by it.
import { FIXTURE_CALENDAR_FACTS } from "@/app/(account)/app/calendar/fixture";
import type { CalendarFacts } from "@/app/(account)/app/calendar/month";

export const STOP = Object.freeze({
  since: new Date(Date.UTC(2026, 8, 13, 0, 0, 0)),
  resumes: { promised: false } as const,
  needs: { kind: "nothing" } as const,
  partial: false,
});

export const ALL_ARMS: CalendarFacts = Object.freeze({
  ...FIXTURE_CALENDAR_FACTS,
  stop: STOP,
  unusedSupply: 0,
  drafts: FIXTURE_CALENDAR_FACTS.drafts.filter((draft) => draft.scheduledFor !== "2026-09-20"),
});
