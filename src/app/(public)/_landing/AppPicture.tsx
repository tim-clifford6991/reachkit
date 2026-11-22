// The hero's right column: the example business's Overview in a browser frame, in the order Overview runs
// (Today's Page, the four tiles, This Week), with the same keys, so the picture cannot say what the app does not.
// Nothing inside is focusable: the controls are drawings, and the caption describes the figure.
import type React from "react";
import { Clock4, CircleStop, Eye } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { AI_WINDOW_WEEKS } from "@/app/(account)/app/_overview/tiles";
import { EXAMPLES, EXAMPLE_TILES, LIVE_AT, weekDays, type PlannedDay } from "../_how/specimen";

/** Bound to names: the copy sweep reads a bare JSX string as voice. */
const APP_HOST = "app.reachkit.app";
const TEST_ID = "landing-app";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const TITLE = "text-sm font-bold";

const TILES = [
  { key: "pages", name: "overview.tile.pages.name", of: "overview.tile.pages.of" },
  { key: "google", name: "overview.tile.google.name", of: "overview.tile.google.of" },
  { key: "ai", name: "overview.tile.ai.name", of: "overview.tile.ai.of" },
  { key: "rivals", name: "overview.tile.rivals.name", of: "overview.tile.rivals.of" },
] as const;

const STATE: Readonly<Record<PlannedDay["state"], CopyKey>> = {
  live: "calendar.stage.live",
  waiting: "calendar.stage.scheduled",
  planned: "calendar.stage.planned",
};

/** Today is the drawn week's Tuesday: its page waits to go live, and the next three days follow. */
const TODAY = 1;

export function AppPicture(): React.JSX.Element {
  const { plan } = EXAMPLES.software;
  const days = weekDays();
  return (
    <figure className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-3 lg:max-w-none" data-testid={TEST_ID}>
      <div className={`mockup-browser border-base-300 bg-base-100 w-full border ${FLOAT}`}>
        <div className="mockup-browser-toolbar">
          <div className="input min-w-0">{APP_HOST}</div>
        </div>
        <div className="border-base-300 pointer-events-none flex min-w-0 flex-col gap-4 border-t p-4 text-left select-none sm:p-5">
          <div className="card card-border bg-base-100 min-w-0">
            <div className="card-body min-w-0 gap-3 p-4">
              <p className="text-primary flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] uppercase">
                <Clock4 {...ICON} />
                {copy("overview.today.eyebrow", { time: LIVE_AT })}
              </p>
              <p className="font-bold">{plan[TODAY]!.title}</p>
              <span className="flex flex-wrap gap-2">
                <span className="btn btn-soft btn-primary btn-sm">
                  <Eye {...ICON} />
                  {copy("overview.alert.pending-veto.action")}
                </span>
                <span className="btn btn-ghost btn-warning btn-sm">
                  <CircleStop {...ICON} />
                  {copy("overview.waiting.stop")}
                </span>
              </span>
            </div>
          </div>
          <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
            {TILES.map(({ key, name, of }) => {
              const tile = EXAMPLE_TILES[key];
              const m = String(tile.of);
              return (
                <li key={key} className="card card-border bg-base-100 min-w-0">
                  <span className="card-body min-w-0 gap-1.5 p-3">
                    <span className="min-w-0 text-sm font-semibold">{copy(name)}</span>
                    <span className="text-3xl leading-snug font-semibold tabular-nums">{tile.n}</span>
                    <span className="text-base-content/70 text-sm">{key === "pages" ? copy(of, { total: m }) : copy(of, key === "ai" ? { n: m, weeks: String(AI_WINDOW_WEEKS) } : { m })}</span>
                    <span className={`text-sm ${tile.up > 0 ? "text-success" : "text-base-content/70"}`}>
                      {tile.up > 0 ? copy("overview.tile.change.up", { n: String(tile.up) }) : copy("overview.tile.change.same")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={TITLE}>{copy("overview.week.title")}</p>
          <ol className="flex min-w-0 flex-col gap-2">
            {plan.slice(TODAY + 1, TODAY + 4).map((day, i) => (
              <li key={day.title} className="rounded-box bg-base-200 flex min-w-0 items-center gap-3 px-3 py-2 text-sm">
                <span className="num text-base-content/70 w-12 shrink-0 text-xs">{days[TODAY + 1 + i]}</span>
                <span className="min-w-0 flex-1 font-semibold">{day.title}</span>
                <span className="badge badge-ghost badge-sm shrink-0">{copy(STATE[day.state])}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="text-base-content/70 text-center text-sm">{copy("landing.inside.caption", { business: EXAMPLES.software.business })}</figcaption>
    </figure>
  );
}
