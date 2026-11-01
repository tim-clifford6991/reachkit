// Step 2's picture: three days of the example business's week, each with what ReachKit did and where it stands.
import type React from "react";
import { CircleCheck, Clock4, FileText, Search } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_HERO, SPECIMEN_HERO_PLACE, specimenHeroWeek } from "./specimen";
import { STEP_FIGURE } from "./sections";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const HERO_TEST_ID = "landing-inside";
/** The phone joins the day and the kind with a dot, as the board does; it is punctuation, not a sentence. */
const DOT = "·";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const TILE = "rounded-field grid size-8 place-items-center";

interface Day {
  readonly weekday: string;
  readonly title: string;
  readonly kind: string;
  readonly tile: string;
  readonly icon: React.JSX.Element;
  readonly badge: React.JSX.Element;
}

function days(): readonly Day[] {
  const week = specimenHeroWeek();
  const newPage = copy("landing.inside.new");
  return [
    {
      weekday: week[0].weekday,
      title: copy("how.top.monday", { buyers: copy("landing.inside.buyers", { place: SPECIMEN_HERO_PLACE }) }),
      kind: copy("landing.inside.research"),
      tile: "bg-primary/10 text-primary",
      icon: <Search {...ICON} />,
      badge: (
        <span className="badge badge-soft badge-primary badge-sm gap-1">
          <CircleCheck size={12} strokeWidth={1.75} aria-hidden />
          {copy("landing.inside.done")}
        </span>
      ),
    },
    {
      weekday: week[1].weekday,
      title: copy("landing.hero.page.5"),
      kind: newPage,
      tile: "bg-success/10 text-success",
      icon: <FileText {...ICON} />,
      badge: (
        <span className="badge badge-soft badge-success badge-sm gap-1">
          {copy("calendar.stage.live")}
          <Num>{SPECIMEN_HERO.liveAt}</Num>
        </span>
      ),
    },
    {
      weekday: week[2].weekday,
      title: copy("landing.hero.page.2"),
      kind: newPage,
      tile: "bg-base-200 text-base-content/70",
      icon: <FileText {...ICON} />,
      badge: (
        <span className="badge badge-ghost badge-sm gap-1">
          <Clock4 size={12} strokeWidth={1.75} aria-hidden />
          {copy("landing.inside.tomorrow")}
        </span>
      ),
    },
  ];
}

/** A phone puts the day and kind on line 2 and the badge on line 3; wider, the day leads the row and the badge ends it.
 *  Each row is one run of inline text in the phone's reading order. */
export function InsideReachKit(): React.JSX.Element {
  return (
    <figure className={STEP_FIGURE} aria-label={copy("landing.inside.title")} data-testid={HERO_TEST_ID}>
      <div className="card-body gap-3.5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-primary text-xs font-semibold">{copy("landing.inside.title")}</p>
          <span className="badge badge-soft badge-success badge-sm">{copy("landing.story.autopilot")}</span>
        </div>
        <ol className="flex flex-1 flex-col gap-2.5">
          {days().map((day) => (
            <li
              key={day.weekday}
              className="rounded-box bg-base-200 grid flex-1 grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-3 gap-y-1.5 px-3.5 py-3 sm:grid-cols-[2rem_auto_minmax(0,1fr)_auto]"
            >
              <span className={`${TILE} ${day.tile} row-span-3 self-center sm:col-start-2 sm:row-span-2`}>{day.icon}</span>
              <span className="text-sm font-semibold sm:col-start-3 sm:row-start-1">{day.title}</span>
              <span className="text-base-content/70 flex gap-1 text-xs sm:contents">
                <span className="num sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:self-center">{day.weekday}</span>
                <span aria-hidden className="sm:hidden">
                  {DOT}
                </span>
                <span className="sm:col-start-3 sm:row-start-2">{day.kind}</span>
              </span>
              <span className="justify-self-start sm:col-start-4 sm:row-span-2 sm:row-start-1 sm:self-center">{day.badge}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
