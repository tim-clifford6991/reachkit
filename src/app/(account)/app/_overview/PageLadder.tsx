// SPEC §4 (owner E4, 2026-10-19; board Main) — how far the live pages have
// got on Google and in AI answers, then each page with its highest steps and
// its label, opening the page's own screen. A step not read says so.
import type React from "react";
import Link from "next/link";
import { Eye, Globe, Link as LinkIcon, Search, Sparkles, Trophy, User, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount, formatDay } from "../_shell/format";
import { LABEL, LabelBadge } from "../_shell/verdict";
import type { PageLadder as Model, StepFigure } from "@/lib/measure/page-ladder";
import { CLOSED } from "./present";

const ROWS_ID = "overview-ladder-pages";
const ON_GOOGLE = { title: "draft.ladder.google", sub: "overview.ladder.google.sub", testId: "overview-ladder-google" } as const;
const IN_AI = { title: "draft.ladder.ai", sub: "overview.ladder.ai.sub", testId: "overview-ladder-ai" } as const;

/** The ladder steps `page-ladder.ts` names, so a step without its board icon fails the type check. */
type StepName =
  | "draft.ladder.live"
  | "draft.ladder.found"
  | "draft.ladder.showing"
  | "draft.ladder.first-page"
  | "draft.ladder.read"
  | "draft.ladder.linked"
  | "draft.ladder.visit";

const STEP_ICON: Readonly<Record<StepName, LucideIcon>> = {
  "draft.ladder.live": Globe,
  "draft.ladder.found": Search,
  "draft.ladder.showing": Eye,
  "draft.ladder.first-page": Trophy,
  "draft.ladder.read": Sparkles,
  "draft.ladder.linked": LinkIcon,
  "draft.ladder.visit": User,
};
const Climbing = LABEL.climbing.icon;
const iconOf = (name: CopyKey): LucideIcon | undefined => (STEP_ICON as Partial<Record<CopyKey, LucideIcon>>)[name];

function Steps(p: { title: CopyKey; sub: CopyKey; steps: readonly StepFigure[]; climbing: number; testId: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={p.testId}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-semibold">{copy(p.title)}</h3>
        <p className="text-sm text-base-content/70">{copy(p.sub)}</p>
      </div>
      <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {p.steps.map((step) => {
          const Icon = iconOf(step.name);
          return (
            <li key={step.name} className="min-w-0 rounded-box bg-base-200 p-3 text-sm" data-step={step.name}>
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/70">
                {Icon === undefined ? null : <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                {`${step.n} · ${copy(step.name)}`}
              </span>
              {step.count === null ? (
                <span className="block font-semibold">{copy("draft.ladder.unmeasured")}</span>
              ) : (
                <>
                  <a className="num link link-hover block text-2xl font-semibold" href={`#${ROWS_ID}`}>
                    {formatCount(step.count)}
                  </a>
                  {step.of === 0 ? null : <progress className="progress progress-primary w-full" value={step.count} max={step.of} aria-hidden />}
                  <span className="block">{copy(step.line, { n: formatCount(step.of) })}</span>
                </>
              )}
              {step.name === "draft.ladder.showing" && p.climbing > 0 ? (
                <span className={`${LABEL.climbing.badge} mt-1`}>
                  <Climbing className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {copy("overview.ladder.climbing", { n: formatCount(p.climbing) })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PageLadder(p: { ladder: Model; timeZone: string }): React.JSX.Element {
  const { ladder } = p;
  const week1 = ladder.week1;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-ladder">
      <div className="card-body min-w-0 gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
          <h2>{copy("overview.ladder.title", { n: formatCount(ladder.live) })}</h2>
          {ladder.readAt === null && ladder.unread === 0 ? null : (
            <p className="text-sm text-base-content/70">
              {[
                ladder.readAt === null ? null : copy("overview.ladder.read", { on: formatDay(ladder.readAt, p.timeZone) }),
                ladder.unread === 0 ? null : copy("overview.ladder.unread", { k: formatCount(ladder.unread) }),
              ]
                .filter((part): part is string => part !== null)
                .join(" · ")}
            </p>
          )}
        </div>
        <Steps {...ON_GOOGLE} steps={ladder.google} climbing={ladder.climbing} />
        {ladder.visits !== null && ladder.visits > 0 ? (
          <p className="text-sm" data-testid="overview-ladder-visits">
            {copy("overview.ladder.visits", { n: formatCount(ladder.visits) })}
          </p>
        ) : null}
        <Steps {...IN_AI} steps={ladder.ai} climbing={0} />
        {week1 === null ? null : (
          <p className="text-sm text-base-content/70" data-testid="overview-ladder-week1">
            {week1.found === null || week1.read === null
              ? copy("overview.ladder.week1.short", { live: formatCount(week1.live) })
              : copy("overview.ladder.week1", { live: formatCount(week1.live), found: formatCount(week1.found), read: formatCount(week1.read) })}
          </p>
        )}
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>{copy("overview.ladder.how.title")}</summary>
          <div className={`${CLOSED.body} text-sm`}>
            <p>{copy("overview.ladder.how.google")}</p>
            <p>{copy("overview.ladder.how.ai")}</p>
          </div>
        </details>
        <ul className="list min-w-0" id={ROWS_ID} data-testid="overview-ladder-rows">
          {ladder.rows.map((row) => (
            <li key={row.id} className="list-row min-w-0 items-center px-0" data-testid="overview-ladder-row">
              <div className="list-col-grow min-w-0">
                {row.href === null ? (
                  <p className="truncate font-semibold" title={row.title}>{row.title}</p>
                ) : (
                  <Link className="link link-hover block truncate font-semibold" href={row.href} title={row.title}>
                    {row.title}
                  </Link>
                )}
                <p className="text-sm text-base-content/70" data-testid="overview-ladder-row-steps">
                  {[copy(row.google), row.measured ? (row.ai === null ? null : copy(row.ai)) : copy("draft.ladder.unmeasured")]
                    .filter((part): part is string => part !== null)
                    .join(" · ")}
                </p>
              </div>
              {row.label === null ? null : <LabelBadge label={row.label} className="shrink-0" />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
