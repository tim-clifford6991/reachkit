// How it works' pictures: each one draws a single example business from
// `specimen.ts` in daisyUI parts, so the Plumber · Software switch renders it
// twice and shows one. No sentence lives here; ReachKit's words are `how.*`.
import type React from "react";
import {
  ArrowDown,
  Bot,
  Check,
  CircleCheck,
  CircleStop,
  Clock,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "./facts";
import { ExampleSwitch } from "./ExampleSwitch";
import { EXAMPLES, LIVE_AT, REASON_COPY, weekDays, type Example } from "./specimen";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const CARD = "card card-border bg-base-100 min-w-0";
const SMALL = "text-base-content/70 text-xs";
const LABEL = "text-primary text-xs font-semibold";
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3";

/** A visual drawn for both example businesses, the plumber shown first. */
export function Switched(p: { draw: (e: Example) => React.ReactNode }): React.JSX.Element {
  return (
    <ExampleSwitch
      label={copy("how.switch")}
      names={{ plumber: copy("how.switch.plumber"), software: copy("how.switch.software") }}
      plumber={p.draw(EXAMPLES.plumber)}
      software={p.draw(EXAMPLES.software)}
    />
  );
}

function ExampleLine(): React.JSX.Element {
  return <p className={SMALL}>{copy("landing.hero.example")}</p>;
}

function LiveBadge(p: { at?: string }): React.JSX.Element {
  return (
    <span className="badge badge-success badge-sm shrink-0 gap-1">
      <CircleCheck size={12} strokeWidth={1.75} aria-hidden />
      {copy("calendar.stage.live")}
      {p.at === undefined ? null : <Num>{p.at}</Num>}
    </span>
  );
}

/** The head: the owner's week beside ReachKit's. */
export function TwoWeeks(e: Example): React.JSX.Element {
  const days = weekDays();
  return (
    <figure className={CARD}>
      <div className="card-body gap-4">
        <p className={LABEL}>{copy("how.top.visual")}</p>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <p className="text-base font-semibold">{copy("how.top.yours")}</p>
              <p className={SMALL}>{copy("how.top.yours.line", { business: e.business })}</p>
            </div>
            <ol className="flex flex-col gap-1">
              {e.jobs.map((job, i) => (
                <li key={days[i]} className="flex min-w-0 gap-2 text-sm">
                  <span className="num text-base-content/70 w-14 shrink-0">{days[i]}</span>
                  <span className="min-w-0">{job}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <p className="text-base font-semibold">{copy("how.top.ours")}</p>
              <p className={SMALL}>{copy("how.top.ours.line", { business: e.business })}</p>
            </div>
            <ol className="flex flex-col gap-1">
              <li className="flex min-w-0 gap-2 text-sm">
                <span className="num text-base-content/70 w-14 shrink-0">{days[0]}</span>
                <span className="min-w-0">{copy("how.top.monday", { buyers: e.buyers })}</span>
              </li>
              {e.live.map((title, i) => (
                <li key={title} className="flex min-w-0 flex-wrap items-start gap-2 text-sm">
                  <span className="num text-base-content/70 w-14 shrink-0">{days[i + 1]}</span>
                  <span className="min-w-0 flex-1">{title}</span>
                  <LiveBadge />
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="text-sm font-semibold">{copy("how.top.split", { minutes: HOW_FACTS.setupMinutes })}</p>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#research`: the business, as ReachKit read it. */
export function AsWeRead(e: Example): React.JSX.Element {
  const rows = [
    ["how.read.name", e.business, copy("how.read.from", { source: e.site })],
    ["how.read.sell", e.read.sell[0], copy("how.read.from", { source: `${e.site}${e.read.sell[1]}` })],
    ["how.read.buyers", e.read.buyers[0], copy("how.read.from", { source: `${e.site}${e.read.buyers[1]}` })],
    ["how.read.where", e.read.where[0], copy("how.read.from", { source: `${e.site}${e.read.where[1]}` })],
    ["how.read.language", e.read.language, copy("how.read.whole")],
  ] as const;
  return (
    <figure className={CARD}>
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={LABEL}>{copy("how.read.title")}</p>
          <span className="badge badge-ghost badge-sm">{copy("how.read.pages", { pages: e.pagesRead })}</span>
        </div>
        <dl className="divide-base-300 flex flex-col divide-y">
          {rows.map(([label, value, from]) => (
            <div key={label} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className={SMALL}>{copy(label)}</dt>
              <dd className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{value}</span>
                <span className="num text-base-content/70 text-xs">{from}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className={SMALL}>{copy("how.read.fix")}</p>
        <div className={WELL}>
          <p className="text-sm font-semibold">{copy("how.read.held")}</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex flex-wrap justify-between gap-2">
              {copy("how.read.held.ai")}
              <span className="badge badge-soft badge-primary badge-sm">{copy("how.read.held.free")}</span>
            </li>
            <li className="flex flex-wrap justify-between gap-2">
              {copy("how.read.held.list")}
              <span className="badge badge-soft badge-primary badge-sm">{copy("how.read.held.free")}</span>
            </li>
            <li className="flex flex-wrap justify-between gap-2">
              {copy("how.read.held.slow", { count: e.slowPages })}
              <span className="badge badge-ghost badge-sm">{copy("how.read.held.report")}</span>
            </li>
          </ul>
        </div>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#competitors`: who Google and AI send the buyers to today. */
export function WhoGetsThem(e: Example): React.JSX.Element {
  return (
    <figure className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className={`${LABEL} flex items-center gap-1`}>
            <Search {...ICON} />
            {copy("how.rivals.google")}
          </p>
          <p className="rounded-box bg-base-200 px-3 py-2 text-sm">
            <Num phrase>{e.search}</Num>
          </p>
          <p className={SMALL}>{copy("how.rivals.first")}</p>
          <ol className="flex flex-col gap-2">
            {e.results.map((r) => (
              <li key={r.url} className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{r.name}</span>
                <span className="num text-base-content/70 text-xs">{r.url}</span>
                <span className="text-primary text-sm">{r.title}</span>
              </li>
            ))}
          </ol>
          <p className="text-error flex items-center gap-1 text-sm font-semibold">
            <X {...ICON} />
            {copy("how.rivals.missing", { business: e.business })}
          </p>
        </div>
      </div>
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className={`${LABEL} flex items-center gap-1`}>
            <Bot {...ICON} />
            {copy("how.rivals.ai")}
          </p>
          <p className="rounded-box bg-base-200 self-end px-3 py-2 text-sm">{e.question}</p>
          <div className="rounded-box border-base-300 flex flex-col gap-2 border p-3">
            <p className={SMALL}>{copy("how.rivals.answer")}</p>
            <p className="text-sm">{e.answer}</p>
            <p className="flex flex-wrap gap-1">
              {e.mentioned.map((domain) => (
                <span key={domain} className="badge badge-ghost badge-sm">
                  <Num>{domain}</Num>
                </span>
              ))}
            </p>
          </div>
          <p className="text-error flex items-center gap-1 text-sm font-semibold">
            <X {...ICON} />
            {copy("how.rivals.absent", { business: e.business })}
          </p>
          <p className={SMALL}>{copy("how.rivals.tally", { n: e.tally.n, total: e.tally.total })}</p>
        </div>
      </div>
      <div className="md:col-span-2">
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#questions`: the questions kept and the one skipped. */
export function QuestionList(e: Example): React.JSX.Element {
  return (
    <figure className={CARD}>
      <div className="card-body gap-3">
        <p className={LABEL}>{copy("how.pick.list", { buyers: e.buyers })}</p>
        <p className={SMALL}>{copy("how.pick.keep")}</p>
        <ul className="divide-base-300 flex flex-col divide-y">
          {e.questions.map((q) => {
            const picked = q.reason !== "off";
            return (
              <li key={q.search} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-2">
                <span className={`flex min-w-0 flex-col ${picked ? "" : "text-base-content/70"}`}>
                  <Num phrase>{q.search}</Num>
                  <span className={SMALL}>{copy("how.pick.volume", { n: q.volume.toLocaleString("en-US") })}</span>
                  <span className="text-sm">{copy(REASON_COPY[q.reason])}</span>
                </span>
                {picked ? (
                  <span className="badge badge-soft badge-primary badge-sm shrink-0 gap-1">
                    <Check size={12} strokeWidth={1.75} aria-hidden />
                    {copy("how.pick.picked")}
                  </span>
                ) : (
                  <span className="badge badge-ghost badge-sm shrink-0 gap-1">
                    <X size={12} strokeWidth={1.75} aria-hidden />
                    {copy("how.pick.skipped")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className={SMALL}>{copy("how.pick.caption")}</p>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#pages`: one week of pages, each on its own day. */
export function WeekOfPages(e: Example): React.JSX.Element {
  const days = weekDays();
  return (
    <figure className={CARD}>
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={LABEL}>{copy("how.week.name", { business: e.business })}</p>
          <span className="badge badge-soft badge-success badge-sm">{copy("how.week.auto")}</span>
        </div>
        <p className={`${SMALL} flex items-center gap-1`}>
          <Search size={12} strokeWidth={1.75} aria-hidden />
          {copy("how.week.monday")}
        </p>
        <ol className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {e.plan.map((day, i) =>
            day.kind === "skip" ? (
              <li key={days[i]} className="rounded-box border-base-300 flex min-w-0 flex-col gap-1 border border-dashed p-3">
                <span className="num text-base-content/70 text-xs">{days[i]}</span>
                <span className="text-base-content/70 text-sm">{copy("how.week.skip")}</span>
              </li>
            ) : (
              <li
                key={days[i]}
                className={`rounded-box flex min-w-0 flex-col gap-2 border p-3 ${day.state === "waiting" ? "border-primary bg-primary/5" : "border-base-300"}`}
              >
                <span className="flex flex-wrap items-center justify-between gap-1">
                  <span className="num text-base-content/70 text-xs">{days[i]}</span>
                  <span className="badge badge-ghost badge-sm gap-1">
                    {day.kind === "update" ? <RefreshCw size={12} strokeWidth={1.75} aria-hidden /> : null}
                    {copy(day.kind === "new" ? "how.week.new" : "how.week.update")}
                  </span>
                </span>
                <span className="text-sm font-semibold">{day.title}</span>
                <span className={SMALL}>{day.reason}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1">
                  {day.state === "live" ? <LiveBadge at={LIVE_AT} /> : null}
                  {day.state === "planned" ? <span className="badge badge-ghost badge-sm">{copy("how.week.planned")}</span> : null}
                  {day.state === "waiting" ? (
                    <>
                      <span className="flex items-center gap-1 text-xs">
                        <Clock size={12} strokeWidth={1.75} aria-hidden />
                        {copy("how.week.waiting", { time: LIVE_AT })}
                      </span>
                      <span className="badge badge-ghost badge-sm gap-1">
                        <Pencil size={12} strokeWidth={1.75} aria-hidden />
                        {copy("how.week.edit")}
                      </span>
                      <span className="badge badge-ghost badge-sm gap-1">
                        <CircleStop size={12} strokeWidth={1.75} aria-hidden />
                        {copy("how.week.stop")}
                      </span>
                    </>
                  ) : null}
                </span>
              </li>
            )
          )}
        </ol>
        <div className="mockup-browser border-base-300 min-w-0 border">
          <div className="mockup-browser-toolbar min-w-0">
            <div className="input w-full min-w-0">
              <span className="truncate">{`${e.blog}${e.pagePath}`}</span>
            </div>
          </div>
          <p className="border-base-300 border-t px-4 py-3 text-sm">{copy("how.week.address")}</p>
        </div>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#true`: a page with where each fact came from. */
export function PageWithSources(e: Example): React.JSX.Element {
  const checks = String(HARD_RULES.length);
  return (
    <figure className="mockup-browser border-base-300 bg-base-100 min-w-0 border">
      <div className="mockup-browser-toolbar min-w-0">
        <div className="input w-full min-w-0">
          <span className="truncate">{`${e.blog}${e.pagePath}`}</span>
        </div>
      </div>
      <div className="border-base-300 flex flex-col gap-3 border-t p-5">
        <p className={SMALL}>{e.business}</p>
        <h3 className="text-lg font-semibold">{e.page.title}</h3>
        {e.page.facts.map((fact) => (
          <p key={fact.source} className="flex flex-col gap-1 text-sm">
            <span className="bg-primary/10 rounded px-1">{fact.text}</span>
            <span className="num text-primary text-xs">
              {copy("how.read.from", { source: `${e.site}${fact.source}` })}
            </span>
          </p>
        ))}
        <p className="flex flex-col gap-1 text-sm">
          <s className="text-base-content/70">{e.page.never}</s>
          <span className="text-error text-xs font-semibold">{copy("how.true.never")}</span>
        </p>
        <span className="badge badge-success gap-1 self-start">
          <CircleCheck size={14} strokeWidth={1.75} aria-hidden />
          {copy("how.true.passed", { checks })}
        </span>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#found`: the Monday email, framed as a phone. */
export function MondayEmail(e: Example): React.JSX.Element {
  const first = e.plan[0];
  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <div className="mockup-phone border-base-300 max-w-72">
        <div className="mockup-phone-camera" />
        <div className="mockup-phone-display bg-base-100 flex flex-col gap-3 overflow-y-auto px-4 pt-12 pb-6 text-sm">
          <p className="flex items-center gap-1 font-semibold">
            <Mail {...ICON} />
            {copy("how.mail.subject")}
          </p>
          <p>{copy("how.mail.hi", { name: e.mail.name, week: e.mail.week, business: e.business })}</p>
          <p className="rounded-box bg-success/10 p-2 text-xs">{copy("how.mail.calm", { time: LIVE_AT })}</p>
          <ul className="flex flex-col gap-1 font-semibold">
            <li>{copy("how.mail.live", { n: e.mail.live })}</li>
            <li>{copy("how.mail.planned", { n: e.mail.planned })}</li>
            <li>{copy("how.mail.linked", { n: e.mail.linked, total: e.mail.live })}</li>
          </ul>
          <p className={LABEL}>{copy("how.mail.pages")}</p>
          {first === undefined ? null : (
            <p className={WELL}>
              <span className="text-xs font-semibold">{first.title}</span>
              <span className={SMALL}>{first.reason}</span>
            </p>
          )}
        </div>
      </div>
      <figcaption className={SMALL}>{copy("how.mail.caption")}</figcaption>
    </figure>
  );
}

const WHEN = ["first", "found", "showing", "top"] as const;

/** `#found`: what moves when, as time ranges and never as dates. */
export function WhatToExpect(): React.JSX.Element {
  return (
    <div className={CARD}>
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">{copy("how.when.title")}</h3>
          <span className={SMALL}>{copy("how.when.sub")}</span>
        </div>
        <ul className="timeline timeline-vertical timeline-compact min-w-0">
          {WHEN.map((step, i) => (
            <li key={step}>
              {i > 0 ? <hr className="bg-base-300" /> : null}
              <div className="timeline-middle text-primary">
                <CircleCheck {...ICON} />
              </div>
              <div className="timeline-end mb-3 flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{copy(`how.when.${step}.at` as CopyKey)}</span>
                <span className="text-base-content/70 text-sm">{copy(`how.when.${step}.what` as CopyKey)}</span>
              </div>
              {i < WHEN.length - 1 ? <hr className="bg-base-300" /> : null}
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold">{copy("how.when.promise")}</p>
        <p className={SMALL}>{copy("how.when.maps")}</p>
      </div>
    </div>
  );
}

/** `#you-do`: three steps once, then nothing every week. */
export function YourPart(e: Example): React.JSX.Element {
  const waiting = e.plan.find((day) => day.state === "waiting");
  return (
    <figure className={CARD}>
      <div className="card-body gap-4">
        <p className={`${LABEL} flex items-center gap-1`}>
          <Clock {...ICON} />
          {copy("how.part.clock", { minutes: HOW_FACTS.setupMinutes })}
        </p>
        <ol className="steps steps-vertical min-w-0">
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="font-semibold">{copy("how.part.one")}</span>
              <span className="num num-phrase text-base-content/70 text-xs">{`${e.site} · ${e.area}`}</span>
            </span>
          </li>
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="flex flex-wrap items-center gap-1 font-semibold">
                {copy("how.part.two")}
                <span className="badge badge-ghost badge-sm">{copy("how.part.optional")}</span>
              </span>
              <span className={SMALL}>{copy("how.part.two.line")}</span>
            </span>
          </li>
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="font-semibold">{copy("how.part.three")}</span>
              <span className={SMALL}>{copy("how.part.three.line")}</span>
            </span>
          </li>
        </ol>
        <p className="flex items-center gap-1 text-sm font-semibold">
          <ArrowDown {...ICON} />
          {copy("how.part.after")}
        </p>
        {waiting === undefined ? null : (
          <div className={WELL}>
            <span className={SMALL}>{copy("how.part.page")}</span>
            <span className="text-sm font-semibold">{waiting.title}</span>
            <span className="flex flex-wrap gap-1">
              <span className="badge badge-ghost badge-sm gap-1">
                <Pencil size={12} strokeWidth={1.75} aria-hidden />
                {copy("how.week.edit")}
              </span>
              <span className="badge badge-ghost badge-sm gap-1">
                <CircleStop size={12} strokeWidth={1.75} aria-hidden />
                {copy("how.week.stop")}
              </span>
            </span>
          </div>
        )}
        <p className={SMALL}>{copy("how.part.window", { hours: HOW_FACTS.windowHours })}</p>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#start`: the three figures a free report opens on. */
export function ReportGlance(e: Example): React.JSX.Element {
  return (
    <figure className={CARD}>
      <div className="card-body gap-3">
        <p className={LABEL}>{copy("how.start.glance")}</p>
        <div className="stats stats-vertical min-w-0">
          <div className="stat px-0">
            <div className="stat-value text-3xl">{copy("how.start.score", { score: e.report.score, max: 100 })}</div>
            <div className="stat-title text-base-content font-semibold">{copy("band.score.hard-to-find")}</div>
            <div className="stat-desc text-base-content/70 whitespace-normal">{copy("how.start.score.name")}</div>
          </div>
          <div className="stat px-0">
            <div className="stat-desc text-base-content text-sm whitespace-normal">
              {copy("how.start.ai", { n: e.report.mentioned, total: e.report.asked })}
            </div>
          </div>
          <div className="stat px-0">
            <div className="stat-desc text-base-content text-sm whitespace-normal">
              {copy("how.start.missing", { n: e.report.missing })}
            </div>
          </div>
        </div>
        <figcaption className={SMALL}>{copy("how.start.caption", { business: e.business })}</figcaption>
      </div>
    </figure>
  );
}

