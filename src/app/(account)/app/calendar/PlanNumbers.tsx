// Board Plan — the four numbers: the week's pages, the pages live so far,
// the spares kept ready and the days stopped by the customer.
//
// A count of pages is a count, so a zero is a zero and is drawn quiet. The
// live count alone is a read that can fail, and a failed read says so
// rather than 0.
//
// daisyUI `card` cells on the Overview tiles' own grid — two columns on a
// phone and one row from `lg` — with no class of their own.
import type React from "react";
import { Calendar, CircleStop, Globe, List, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount } from "../_shell/format";
import { NUMBERS, REGION } from "./frame";

export interface PlanFigures {
  week: number;
  /** `null` where the live pages could not be read. */
  live: number | null;
  spares: number;
  stopped: number;
}

const LINE: Readonly<Record<keyof PlanFigures, CopyKey>> = {
  week: "calendar.numbers.week",
  live: "calendar.numbers.live",
  spares: "calendar.numbers.spares",
  stopped: "calendar.numbers.stopped",
};

const ICON: Readonly<Record<keyof PlanFigures, LucideIcon>> = {
  week: Calendar,
  live: Globe,
  spares: List,
  stopped: CircleStop,
};

export function PlanNumbers(p: { figures: PlanFigures }): React.JSX.Element {
  return (
    <div
      className={NUMBERS}
      data-testid="plan-numbers"
      data-frame={REGION.numbers}
    >
      {(Object.keys(LINE) as (keyof PlanFigures)[]).map((name) => {
        const value = p.figures[name];
        const Icon = ICON[name];
        return (
          <div
            key={name}
            className="card card-border min-w-0 bg-base-100"
            data-testid={`plan-number-${name}`}
          >
            <div className="card-body flex-row items-center gap-3 p-4">
              <span aria-hidden className="rounded-field grid size-9 shrink-0 place-items-center bg-base-200">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col gap-1" data-testid={`plan-number-${name}-text`}>
                {value === null ? (
                  <span className="text-sm font-semibold text-base-content/70">
                    {copy("calendar.numbers.unread")}
                  </span>
                ) : (
                  <span
                    className={`figure text-3xl leading-none${value === 0 ? " text-base-content/70" : ""}`}
                    data-testid={`plan-number-${name}-value`}
                  >
                    {formatCount(value)}
                  </span>
                )}
                <span className="min-w-0 text-sm text-base-content/70">
                  {copy(LINE[name])}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
