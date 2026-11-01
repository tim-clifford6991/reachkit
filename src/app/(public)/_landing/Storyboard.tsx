// The hero's story card (board PubLanding v36): one example business in four
// frames. A competitor is found, we research, we write pages, and you are
// found. The header names the business beside its own mark. Frames 1 and 4
// are the same answer with one swap, so the eye reads the change. On a phone
// each frame stacks its picture under its title; once the card is wide enough
// the picture sits right of the title and a spine joins the nodes. It carries the landing's one deep floating shadow.
import type React from "react";
import { Building2, Calendar, CircleCheck, Clock, FileText, ScanSearch, Search, Sparkles, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import { SiteMark } from "./SiteMark";
import { SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_QUERY, SPECIMEN_HERO_RIVAL, SPECIMEN_HERO_WEEK } from "./specimen";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const STORY_TEST_ID = "landing-story";

const MINI = "rounded-box border border-base-content/20 bg-base-100 flex min-h-37 min-w-0 flex-col justify-between gap-2.5 p-3.5";
const TILE = "rounded-field bg-primary/10 text-primary grid shrink-0 place-items-center";
const WELL = "rounded-field bg-base-200 flex min-w-0 items-center gap-2 px-2.5";
const ROW = "rounded-field flex h-8 min-w-0 items-center gap-2.5 px-2.5";
const RANK = "w-3.5 shrink-0 text-center text-xs";
/** The two places an answer ranks, bound to names: the copy rule reads a bare attribute string as voice. */
const FIRST = "1";
const SECOND = "2";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const SMALL = { ...ICON, size: 12 } as const;
const STATUS = { ...ICON, size: 14 } as const;
const NODE = { ...ICON, size: 18 } as const;

function Frame(p: { n: number; Icon: LucideIcon; children: React.ReactNode }): React.JSX.Element {
  const divider = p.n > 1 ? "border-base-300 border-t pt-4.5 @md:border-t-0 @md:pt-0" : "";
  return (
    <li
      className={`relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 @md:grid-cols-[2.25rem_11rem_minmax(0,1fr)] @md:gap-x-4 ${divider}`}
    >
      {p.n < 4 && <span aria-hidden className="bg-primary/20 absolute top-1/2 left-4 hidden h-[calc(100%+1.125rem)] w-0.5 @md:block" />}
      <span className="bg-primary text-primary-content ring-base-100 relative grid size-9 place-items-center rounded-full ring-4">
        <p.Icon {...NODE} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.9375rem] leading-[1.3] font-bold tracking-[-0.01em] whitespace-nowrap">{copy(`landing.story.${p.n}.title` as CopyKey)}</span>
        <span className="text-base-content/70 text-xs">{copy(`landing.story.${p.n}.when` as CopyKey)}</span>
      </span>
      <div className={`${MINI} col-span-2 @md:col-span-1`}>{p.children}</div>
    </li>
  );
}

/** The search both engines answer, with a chip for each. */
function Query(): React.JSX.Element {
  return (
    <span className="border-base-content/20 flex h-8.5 min-w-0 items-center gap-2 rounded-full border ps-3 pe-1.5">
      <span className="min-w-0 flex-1 truncate text-sm">{SPECIMEN_HERO_QUERY}</span>
      <span className="flex flex-none gap-1">
        <span className="badge badge-ghost badge-sm gap-1 font-semibold">
          <Search {...SMALL} />
          {copy("landing.story.engine.google")}
        </span>
        <span className="badge badge-ghost badge-sm gap-1 font-semibold">
          <Sparkles {...SMALL} />
          {copy("landing.story.engine.ai")}
        </span>
      </span>
    </span>
  );
}

/** One ranked row of the answer. */
function Rank(p: { n: string | null; name: string; className: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <span className={`${ROW} ${p.className}`}>
      <span className={RANK}>{p.n === null ? null : <Num>{p.n}</Num>}</span>
      <span className="flex min-w-0 flex-1 text-xs">
        <Num clamp={p.name}>{p.name}</Num>
      </span>
      {p.children}
    </span>
  );
}

/** The answer's two rows: the lit one is found; below it a dashed empty slot, or the passed-over competitor. */
function Answer(p: { lit: string; you: boolean }): React.JSX.Element {
  const you = copy("landing.story.you");
  return (
    <span className="flex flex-col gap-2">
      <Rank n={FIRST} name={p.lit} className="bg-primary text-primary-content">
        {p.you && <span className="badge badge-sm bg-primary-content text-primary border-0 font-bold">{you}</span>}
      </Rank>
      {p.you ? (
        <Rank n={SECOND} name={SPECIMEN_HERO_RIVAL} className="border-base-content/20 text-base-content/70 border" />
      ) : (
        <span className={`${ROW} border-base-content/50 text-base-content/70 border border-dashed`}>
          {/* No rank yet: the word starts where a rank's name would. */}
          <span className="ms-6 text-sm font-semibold">{you}</span>
        </span>
      )}
    </span>
  );
}

/** What we research: the four inputs of the strategy. */
const INPUTS = [
  { Icon: Building2, key: "landing.story.2.you" },
  { Icon: Users, key: "landing.story.2.competitors" },
  { Icon: Search, key: "landing.story.2.google" },
  { Icon: Sparkles, key: "landing.story.2.ai" },
] as const;

/** The week's three pages: one live, one waiting, one planned, each by icon and word. */
function Week(): React.JSX.Element {
  const status = [
    <span key="live" className="badge badge-soft badge-success badge-sm gap-1">
      <CircleCheck {...SMALL} />
      {copy("landing.story.3.live")}
    </span>,
    <span key="next" className="flex items-center gap-1">
      <Clock {...STATUS} />
      {copy("landing.story.3.next")}
    </span>,
    <span key="planned" className="flex items-center gap-1">
      <Calendar {...STATUS} />
      {copy("landing.story.3.planned")}
    </span>,
  ];
  const { live, planned, pages } = SPECIMEN_HERO_WEEK;
  return (
    <>
      <span className="text-base-content/70 flex items-center gap-2 text-xs font-semibold">
        {copy("landing.story.3.week")}
        <progress className="progress progress-primary h-1.5 flex-1" value={live} max={planned} aria-hidden />
        {copy("landing.story.3.count", { n: String(live), total: String(planned) })}
      </span>
      <span className="flex flex-col gap-1.5">
        {status.map((word, i) => (
          <span key={word.key} className={`${WELL} h-7`}>
            <FileText {...STATUS} className={i === 0 ? "text-primary" : "text-base-content/70"} />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{pages[i]}</span>
            <span className="text-base-content/70 flex w-22 flex-none text-xs">{word}</span>
          </span>
        ))}
      </span>
    </>
  );
}

export function Storyboard(): React.JSX.Element {
  return (
    <figure className={`card bg-base-100 mx-auto w-full max-w-xl min-w-0 overflow-hidden lg:max-w-none ${FLOAT}`} data-testid={STORY_TEST_ID}>
      <h2 className="sr-only">{copy("landing.story.title")}</h2>
      <div className="border-base-300 flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-6">
        <span className="flex min-w-0 items-center gap-3">
          <SiteMark domain={SPECIMEN_HERO_DOMAIN} hasLogo={false} />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold">{SPECIMEN_HERO_BUSINESS}</span>
            <span className="text-base-content/70 flex text-xs">
              <Num clamp={SPECIMEN_HERO_DOMAIN}>{SPECIMEN_HERO_DOMAIN}</Num>
            </span>
          </span>
        </span>
        <span className="badge badge-soft badge-success badge-sm flex-none gap-1.5">
          <span aria-hidden className="bg-success size-1.5 rounded-full" />
          {copy("landing.story.autopilot")}
        </span>
      </div>
      <div className="@container">
        <ol className="flex flex-col gap-4.5 px-4 py-5 sm:px-6">
          <Frame n={1} Icon={Search}>
            <Query />
            <Answer lit={SPECIMEN_HERO_RIVAL} you={false} />
          </Frame>
          <Frame n={2} Icon={ScanSearch}>
            <span className="grid flex-1 grid-cols-2 gap-2.5">
              {INPUTS.map(({ Icon, key }) => (
                <span key={key} className={`${WELL} py-2`}>
                  <span className={`${TILE} bg-base-100 size-7`}>
                    <Icon {...ICON} />
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">{copy(key)}</span>
                </span>
              ))}
            </span>
          </Frame>
          <Frame n={3} Icon={FileText}>
            <Week />
          </Frame>
          <Frame n={4} Icon={TrendingUp}>
            <Query />
            <Answer lit={SPECIMEN_HERO_DOMAIN} you />
          </Frame>
        </ol>
      </div>
    </figure>
  );
}
