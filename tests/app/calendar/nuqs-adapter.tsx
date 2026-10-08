// tests/app/calendar/nuqs-adapter.tsx — the one adapter these suites need
// (issue 930).
//
// The Plan screen holds the open day in the address (`nuqs`), and `nuqs`
// refuses to run without an adapter — in the product that is `NuqsAdapter`
// in the `(account)` layout (`src/app/(account)/layout.tsx`, moved there off
// the document by #988), and a suite that renders a route on its own has no
// layout around it. `NuqsTestingAdapter` is the
// library's own stand-in for exactly that: it reads a fixed query string
// and records writes instead of touching a router.
//
// It is the *adapter* that is stood in, never the screen: every component
// under it is the product's own, and the value `useQueryState` reads is the
// one the address would give it.
import React from "react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { weekOf, type MonthModel, type WeekModel } from "@/app/(account)/app/calendar/month";

/** What the page hands `CalendarView` for a month: the month, and this
 *  week as that month holds it (issue 1340). The fixture's week lies inside
 *  its month, so one model is every month the week touches. */
export function shown(model: MonthModel): { model: MonthModel; week: WeekModel } {
  return { model, week: weekOf([model], model.today) };
}

/** Wrap an element in the testing adapter, with the address it should
 *  believe it is at. The default is no query string at all, which is how a
 *  founder first reaches the screen. */
export function withNuqs(
  element: React.ReactElement,
  searchParams: string | Record<string, string> = ""
): React.ReactElement {
  return <NuqsTestingAdapter searchParams={searchParams}>{element}</NuqsTestingAdapter>;
}
