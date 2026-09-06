// BUILD §4.5 — the one read Overview makes.
//
// The typed seam behind which this screen's data sits. The page calls it
// once and nothing else; what it reads behind the type is this issue's
// fixture (`fixture.ts`) and, when §11's weekly measurement (#41), §9's
// publishing (#45) and the rival sizing (#27) land, the queries that
// replace it — one request-cached read, no second caller, no second shape.
//
// **No module fetches for itself.** Every module on this screen is a pure
// function of the model this returns, so the render performs no
// measurement, no vendor call and no model call — a property
// `tests/app/overview/page.test.tsx` asserts rather than assumes, and one
// that a module reaching for its own data would quietly break.
//
// `React.cache` is what makes it one read per request even if a second
// caller ever asks.
import { cache } from "react";
import { assembleOverview, type OverviewModel } from "./model";
import { FIXTURE_OVERVIEW_FACTS } from "./fixture";

export const readOverview = cache(async function readOverview(): Promise<OverviewModel> {
  return assembleOverview(FIXTURE_OVERVIEW_FACTS);
});
