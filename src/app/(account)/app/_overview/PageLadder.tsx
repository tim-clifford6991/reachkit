// SPEC §4 (owner E4, 2026-10-19; board Main) — how far the live pages have
// got on Google and in AI answers, then each page with its highest steps and
// its label, opening the page's own screen. A step not read says so.
import type React from "react";
import Link from "next/link";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { formatCount, formatDay } from "../_shell/format";
import type { PageLadder as Model, StepFigure } from "@/lib/measure/page-ladder";
import { CLOSED } from "./present";

const ROWS_ID = "overview-ladder-pages";
const ON_GOOGLE = { title: "draft.ladder.google", sub: "overview.ladder.google.sub", testId: "overview-ladder-google" } as const;
const IN_AI = { title: "draft.ladder.ai", sub: "overview.ladder.ai.sub", testId: "overview-ladder-ai" } as const;

export const LABEL: Readonly<Record<Label, { key: CopyKey; badge: string }>> = {
  working: { key: "review.label.working", badge: "badge badge-soft badge-success" },
  climbing: { key: "review.label.climbing", badge: "badge badge-soft badge-primary" },
  too_early: { key: "review.label.too_early", badge: "badge badge-soft" },
  not_moving: { key: "review.label.not_moving", badge: "badge badge-soft badge-warning" },
};

function Steps(p: { title: CopyKey; sub: CopyKey; steps: readonly StepFigure[]; climbing: number; testId: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={p.testId}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-semibold">{copy(p.title)}</h3>
        <p className="text-sm text-base-content/70">{copy(p.sub)}</p>
      </div>
      <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {p.steps.map((step) => (
          <li key={step.name} className="min-w-0 rounded-box bg-base-200 p-3 text-sm" data-step={step.name}>
            <span className="block text-xs font-semibold uppercase tracking-wide text-base-content/70">
              {`${step.n} · ${copy(step.name)}`}
            </span>
            {step.count === null ? (
              <span className="block font-semibold">{copy("draft.ladder.unmeasured")}</span>
            ) : (
              <>
                <a className="num link link-hover block text-2xl font-semibold" href={`#${ROWS_ID}`}>
                  {formatCount(step.count)}
                </a>
                <span className="block">{copy(step.line, { n: formatCount(step.of) })}</span>
              </>
            )}
            {step.name === "draft.ladder.showing" && p.climbing > 0 ? (
              <span className="badge badge-soft badge-primary mt-1">{copy("overview.ladder.climbing", { n: formatCount(p.climbing) })}</span>
            ) : null}
          </li>
        ))}
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
              {row.label === null ? null : <span className={`${LABEL[row.label].badge} shrink-0`}>{copy(LABEL[row.label].key)}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
