// What the one plan gets you, as the board's cards: a tile, a title and one line each. The money-back card waits for the launch gate.
import type React from "react";
import { FilePlus, Link, Mail, Sparkles, Timer, Users, Wrench } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HOW_FACTS } from "../_how/facts";

interface PlanCard {
  readonly title: CopyKey;
  readonly line: CopyKey;
  readonly Icon: typeof FilePlus;
}

const CARDS: readonly PlanCard[] = [
  { title: "landing.plan.pages", line: "landing.plan.pages.line", Icon: FilePlus },
  { title: "landing.plan.facts", line: "landing.plan.facts.line", Icon: Link },
  { title: "landing.plan.mail", line: "landing.plan.mail.line", Icon: Mail },
  { title: "landing.plan.rivals", line: "landing.plan.rivals.line", Icon: Users },
  { title: "landing.plan.site", line: "landing.plan.site.line", Icon: Wrench },
  { title: "landing.plan.tracking", line: "landing.plan.tracking.line", Icon: Sparkles },
  { title: "landing.plan.time", line: "landing.plan.time.line", Icon: Timer },
];

const VARS = {
  weekPages: String(HOW_FACTS.weekPages),
  checks: String(HOW_FACTS.checks),
  rivals: String(HOW_FACTS.rivals),
  minutes: String(HOW_FACTS.setupMinutes),
};

/** A phone draws each card as a row, tile beside the words; wider, four columns whose rows align across a line. */
export function PlanCards(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-4 lg:gap-5">
      {CARDS.map(({ title, line, Icon }) => (
        <li
          key={title}
          className="card card-border bg-base-100 grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3.5 gap-y-1 px-4.5 py-4 lg:row-span-3 lg:grid-cols-1 lg:grid-rows-subgrid lg:gap-y-3 lg:p-6"
        >
          <span className="rounded-field bg-primary/10 text-primary row-span-2 grid size-10 place-items-center lg:row-span-1">
            <Icon size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <h3 className="text-base font-semibold lg:self-end">{copy(title, VARS)}</h3>
          <p className="text-base-content/70 lg:text-sm">{copy(line, VARS)}</p>
        </li>
      ))}
    </ul>
  );
}
