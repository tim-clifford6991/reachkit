// SPEC §4 (owner E4, 2026-10-19; board Main) — how far the live pages have
// got on Google and in AI answers: one row per step with its bar, then this
// week's visits from Google and this week's AI reads. A step not read says so.
import type React from "react";
import Link from "next/link";
import { ChevronDown, Eye, Globe, Link as LinkIcon, Search, Sparkles, Trophy, User, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { BlogReadsModel } from "@/lib/publish/reads/model";
import { formatCount } from "../_shell/format";
import { LABEL } from "../_shell/verdict";
import type { PageLadder as Model, StepFigure } from "@/lib/measure/page-ladder";
import { shownKey } from "@/lib/measure/registry";
import { AI_PAGES_HREF, GOOGLE_PAGES_HREF } from "./Figures";

/** The ladder steps `page-ladder.ts` names, so a step without its board icon fails the type check. */
type StepName =
  | "draft.ladder.live"
  | "draft.ladder.found"
  | "draft.ladder.showing"
  | "draft.ladder.first-page"
  | "draft.ladder.read"
  | "draft.ladder.linked"
  | "draft.ladder.visit";

interface Step {
  icon: LucideIcon;
  /** Overview's name for the step, where it is shorter than the page screen's. */
  label?: CopyKey;
}

const STEP: Readonly<Record<StepName, Step>> = {
  "draft.ladder.live": { icon: Globe },
  "draft.ladder.found": { icon: Search },
  "draft.ladder.showing": { icon: Eye, label: "calendar.live.showing" },
  "draft.ladder.first-page": { icon: Trophy, label: "overview.ladder.first-page" },
  "draft.ladder.read": { icon: Sparkles },
  "draft.ladder.linked": { icon: LinkIcon },
  "draft.ladder.visit": { icon: User },
};
const Climbing = LABEL.climbing.icon;
const stepOf = (name: CopyKey): Step | undefined => (STEP as Partial<Record<CopyKey, Step>>)[name];

const GOOGLE = { title: "draft.ladder.google", testId: "overview-ladder-google", href: GOOGLE_PAGES_HREF } as const;
const AI = { title: "draft.ladder.ai", testId: "overview-ladder-ai", href: AI_PAGES_HREF } as const;

/** This week's AI reads beside last week's; `last` is `null` where no earlier week was counted. */
export function aiReadsOf(reads: BlogReadsModel): { now: number; last: number | null } | null {
  if (!reads.show || reads.fetches.kind === "unmeasured") return null;
  return { now: reads.fetches.value, last: reads.weekly.length < 2 ? null : reads.weekly.at(-2)!.fetches };
}

function aiChange(now: number, last: number | null): string {
  if (last === null) return copy("overview.ai.line.first");
  if (now === last) return copy("overview.ai.line.same");
  return copy(now > last ? "overview.ai.line.up" : "overview.ai.line.down", { n: formatCount(last) });
}

/** One line under a ladder: the count in bold, opening the rows it counts, then what it is against. */
function Line(p: { strong: string; rest: string; testId: string; href: string; figureId?: string }): React.JSX.Element {
  return (
    <p className="flex min-w-0 items-start gap-2 text-sm" data-testid={p.testId}>
      <User className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0">
        <Link className="link link-hover font-bold tabular-nums" href={p.href} prefetch={true} data-testid={p.figureId}>
          {p.strong}
        </Link>
        {` ${p.rest}`}
      </span>
    </p>
  );
}

function Steps(p: { title: CopyKey; steps: readonly StepFigure[]; climbing: number; unread: number; testId: string; href: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={p.testId}>
      <h3 className="text-base font-bold">{copy(p.title)}</h3>
      <ol className="grid min-w-0 gap-4 lg:grid-cols-4">
        {p.steps.map((step) => {
          const own = stepOf(step.name);
          const Icon = own?.icon;
          return (
            <li
              key={step.name}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] content-start items-center gap-x-3 gap-y-2 lg:grid-cols-1 lg:items-start"
              data-step={step.name}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-primary">
                {Icon === undefined ? null : <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                {`${step.n} · ${copy(own?.label ?? step.name)}`}
              </span>
              {step.count === null ? (
                <span className="text-sm font-semibold">{copy("draft.ladder.unmeasured")}</span>
              ) : (
                <>
                  <span className="flex items-baseline gap-1.5">
                    <Link className="link link-hover text-4xl leading-none font-semibold tracking-tight tabular-nums" href={p.href} prefetch={true}>
                      {formatCount(step.count)}
                    </Link>
                    <span className="text-sm text-base-content/70">{copy("overview.ladder.of", { n: formatCount(step.on) })}</span>
                  </span>
                  {step.of === 0 ? null : (
                    <progress className="progress progress-primary col-span-2 h-2.5 w-full bg-base-200 lg:col-span-1" value={step.count} max={step.on} aria-hidden />
                  )}
                </>
              )}
              {/* Each "of N" is every live page; the pages no reading has reached yet are said once, here. */}
              {step.name === "draft.ladder.live" && p.unread > 0 ? (
                <span className="col-span-2 text-xs text-base-content/70 lg:col-span-1" data-testid="overview-ladder-unread">
                  {copy("overview.ladder.unread", { k: formatCount(p.unread) })}
                </span>
              ) : null}
              {step.name === "draft.ladder.showing" && p.climbing > 0 ? (
                <span className={`${LABEL.climbing.badge} col-span-2 justify-self-start lg:col-span-1`}>
                  <Climbing className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {copy("overview.ladder.climbing", { n: formatCount(p.climbing) })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PageLadder(p: { ladder: Model; reads: BlogReadsModel }): React.JSX.Element {
  const { ladder } = p;
  const ai = aiReadsOf(p.reads);
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-ladder">
      <div className="card-body min-w-0 gap-4 p-4 sm:p-6">
        <h2 className="text-xl font-bold tracking-tight">{copy("overview.ladder.title", { n: formatCount(ladder.live) })}</h2>
        <Steps {...GOOGLE} steps={ladder.google} climbing={ladder.climbing} unread={ladder.unread} />
        {ladder.visits !== null && ladder.visits > 0 ? (
          <Line
            strong={copy("overview.ladder.visits", { n: formatCount(ladder.visits) })}
            rest={copy("overview.ladder.this-week")}
            testId="overview-ladder-visits"
            href={GOOGLE_PAGES_HREF}
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-3 border-t border-base-300 pt-4">
          <Steps {...AI} steps={ladder.ai} climbing={0} unread={0} />
          {ai === null ? null : ai.now === 0 ? (
            <p className="text-sm" data-testid="overview-ai-line">
              {copy("overview.ai.reads.none")}
            </p>
          ) : (
            <Line
              strong={copy(ai.now === 1 ? "overview.ai.line.read" : "overview.ai.line.reads", { n: formatCount(ai.now) })}
              rest={aiChange(ai.now, ai.last)}
              testId="overview-ai-line"
              href={AI_PAGES_HREF}
              figureId={shownKey("overview-ai-reads")}
            />
          )}
        </div>
        {ladder.week1 === null ? null : (
          <p className="text-sm text-base-content/70" data-testid="overview-ladder-week1">
            {copy("overview.ladder.week1", { live: formatCount(ladder.week1.live) })}
          </p>
        )}
        {/* daisyUI's collapse keeps the closed body out of the layout; the chevron leads, as drawn. */}
        <details className="collapse group min-w-0 rounded-none">
          <summary className="collapse-title link link-primary link-hover inline-flex min-h-11 items-center gap-2 p-0 text-sm font-semibold no-underline">
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" strokeWidth={1.75} aria-hidden />
            {copy("overview.ladder.how.title")}
          </summary>
          <div className="collapse-content flex min-w-0 flex-col gap-1 px-0 text-sm">
            <p>{copy("overview.ladder.how.google")}</p>
            <p>{copy("overview.ladder.how.ai")}</p>
          </div>
        </details>
      </div>
    </section>
  );
}
