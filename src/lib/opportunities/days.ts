// SPEC §7 — which dates carry a page. One rule for Plan, the week Overview
// counts and the Monday mail: a date's scheduled draft, except one held on a
// date already past, else the open row committed for it.

/** Each date's scheduled draft: the first on it (REQ-043 c1), with the held
 *  ones on dates already past set apart. */
export function placedByDay<P extends { readonly scheduledFor: string; readonly draftId: string }>(
  pages: readonly P[],
  held: ReadonlySet<string>,
  today: string
): { byDay: Map<string, P>; heldDays: string[] } {
  const byDay = new Map<string, P>();
  const heldDays: string[] = [];
  for (const page of pages) {
    if (held.has(page.draftId) && page.scheduledFor < today) heldDays.push(page.scheduledFor);
    else if (!byDay.has(page.scheduledFor)) byDay.set(page.scheduledFor, page);
  }
  return { byDay, heldDays };
}

/** Each of `dates` no draft is placed on, with the open row committed for it, in date order. */
export function plannedByDay(
  committed: readonly { readonly date: string; readonly opportunity: { readonly id: string } }[],
  placed: { has(day: string): boolean },
  dates: readonly string[]
): Map<string, string> {
  const rows = new Map(committed.map((day) => [day.date, day.opportunity.id]));
  const planned = new Map<string, string>();
  for (const day of dates) {
    const id = rows.get(day);
    if (!placed.has(day) && id !== undefined) planned.set(day, id);
  }
  return planned;
}

/** Which week of service `today` falls in, counting the week `first` falls in as 1. Both are `YYYY-MM-DD`. */
export function serviceWeek(first: string, today: string): number {
  const monday = (day: string): number => {
    const at = Date.parse(`${day}T00:00:00Z`);
    return at - ((new Date(at).getUTCDay() + 6) % 7) * 86_400_000;
  };
  return Math.max(1, Math.round((monday(today) - monday(first)) / (7 * 86_400_000)) + 1);
}
