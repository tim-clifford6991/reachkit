// SPEC §4 (2026-09-20, #908) — Overview › Rivals.
//
// "Rivals tab: who is on the first page for the twelve searches, who the
// three answer engines name, how far ahead each rival's footprint is over
// twelve weeks, and the searches rivals win that the site does not, each
// with what ReachKit is doing about it. Market leaders stay on their own
// secondary line (§6, #858). Read from the stored weekly report."
//
// **Two reads, and each one is the only read of its subject.**
// `readRivals()` is this tab's own — the two counting cards and the table.
// `readOverview()` is the Overview's, and the gap card is
// `overview.rivals`: the very module the Overview tab's third tile is drawn
// from. Deriving the gap a second time here is how the tile and this card
// would come to name two different nearest rivals. Both are
// `React.cache`d, so each is one read per request however many callers ask.
//
// **Nothing on this screen fetches for itself**, so the render performs no
// measurement, no vendor call and no model call.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s.
//
// **It writes no sentence.** Every word is the registry's.
//
// **`Suspense`**: the table holds the chosen rival in the URL through
// `nuqs`, which reads the query string with Next's own `useSearchParams` —
// "We recommend wrapping the Client Component that uses `useSearchParams`
// in a `<Suspense/>` boundary"
// (`01-app/03-api-reference/04-functions/use-search-params.md`). One
// daisyUI `skeleton` holds its place, which is what SPEC §4 (2026-09-20)
// asks of every waiting state in the app: a shape, never a spinner.
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { ENGINE_LABEL } from "../../_shell/page-target-words";
import { readOverview } from "../../_overview/provider";
import { readRivals } from "../../_overview/rivals-provider";
import { ANSWER_ENGINES } from "../../_overview/answers-model";
import { formatCount } from "../../_overview/present";
import { RivalModule } from "../../_overview/RivalModule";
import { RivalPresence } from "../../_overview/RivalPresence";
import { RivalTable } from "../../_overview/RivalTable";
import { TAB_HREF } from "../../_overview/tabs";

/** /app/rivals's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.rivals.title") };

export default async function RivalsTabPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference, read through the shell's
  // own request-cached provider rather than restated here: two readers of a
  // customer's time zone is how two parts of one screen come to state two
  // different days.
  const [shell, model, overview] = await Promise.all([readShell(), readRivals(), readOverview()]);

  // A sentence with a date inside it, not a value — the same line, from the
  // same key, the two tabs beside this one state over their own tables.
  const measured =
    model.measuredAt === null
      ? null
      : copy("overview.search.measured", { on: formatDate(model.measuredAt, shell.timeZone) });
  // Where the customer stood when they started, and which engines the
  // second card counted over. Both are written here and handed down, so
  // neither card composes a sentence of its own.
  const started =
    model.firstPageAtStart === null
      ? null
      : copy("overview.rivals.first-page.started", {
          count: formatCount(model.firstPageAtStart),
          of: formatCount(model.firstPage.of),
        });
  const engines = copy("overview.rivals.named.lead", {
    engines: ANSWER_ENGINES.map((engine) => copy(ENGINE_LABEL[engine])).join(", "),
    of: formatCount(model.named.of),
  });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="rivals-tab">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="card-title text-base" data-testid="rivals-title">
          {copy("overview.tab.rivals")}
        </h1>
        <p className="max-w-prose text-sm text-base-content/70">{copy("overview.rivals.lead")}</p>
        {measured === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="rivals-measured">
            {measured}
          </p>
        )}
      </header>

      <RivalPresence
        firstPage={model.firstPage}
        named={model.named}
        startedLine={started}
        enginesLine={engines}
        answersHref={TAB_HREF.ai_answers}
      />

      {/* The card the Overview already draws, from the module the Overview
          already reads — with the one line this tab adds and that tab has
          no room for. */}
      <RivalModule
        rivals={overview.rivals}
        timeZone={shell.timeZone}
        weekZero={overview.weekZero}
        lead={copy("overview.rivals.gap.lead")}
      />

      <Suspense fallback={<div className="skeleton h-96 min-w-0" />}>
        <RivalTable model={model} />
      </Suspense>
    </div>
  );
}
