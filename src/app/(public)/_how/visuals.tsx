// How it works' pictures: each one draws a single example business from
// `specimen.ts` in daisyUI parts. No sentence lives here; ReachKit's words are `how.*`.
import type React from "react";
import {
  ArrowDown,
  ArrowRight,
  Ban,
  Calendar,
  Check,
  CircleCheck,
  CircleStop,
  CircleX,
  Clock,
  Coffee,
  Eye,
  FileText,
  Globe,
  Inbox,
  Info,
  Link,
  List,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  User,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { PageSketch } from "@/ui/PageSketch";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "./facts";
import { LIVE_AT, REASON_COPY, weekDate, weekDays, weekSpan, type Example } from "./specimen";

export const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
export const CARD = "card card-border bg-base-100 min-w-0";
const SMALL = "text-base-content/70 text-xs";
const LABEL = "text-primary text-xs font-semibold";
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3";
const TILE = "rounded-field bg-base-200 grid size-7 shrink-0 place-items-center";
const SMALL_ICON = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const;
/** Both example weeks rest on their last day. */
const DAY_OFF = 6;
/** A score's ring as the free report draws it, sized by the caller with `[--size:…]`. */
export const SCORE_RING =
  "radial-progress text-primary after:hidden shadow-[inset_0_0_0_5px_var(--color-base-200)] [--thickness:5px]";
/** The icon tile a figure opens with. */
export const ICON_TILE = "rounded-field grid size-9 flex-none place-items-center bg-base-200";

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
            <p className="flex flex-col">
              <span className="flex items-center gap-2 text-base font-semibold">
                <User {...ICON} />
                {copy("how.top.yours")}
              </span>
              <span className={SMALL}>{copy("how.top.yours.line", { business: e.business })}</span>
            </p>
            <ol className="flex flex-col gap-1">
              {e.jobs.map((job, i) => (
                <li key={days[i]} className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="num text-base-content/70 w-14 shrink-0">{days[i]}</span>
                  <span className={TILE}>{i === DAY_OFF ? <Coffee {...SMALL_ICON} /> : <Wrench {...SMALL_ICON} />}</span>
                  <span className="min-w-0">{job}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="flex flex-col">
              <span className="flex items-center gap-2 text-base font-semibold">
                <Sparkles {...ICON} />
                {copy("how.top.ours")}
              </span>
              <span className={SMALL}>{copy("how.top.ours.line", { business: e.business })}</span>
            </p>
            <ol className="flex flex-col gap-1">
              <li className="flex min-w-0 items-center gap-2 text-sm">
                <span className="num text-base-content/70 w-14 shrink-0">{days[0]}</span>
                <span className={TILE}>
                  <Search {...SMALL_ICON} />
                </span>
                <span className="min-w-0">{copy("how.top.monday", { buyers: e.buyers })}</span>
              </li>
              {e.live.map((title, i) => (
                <li key={title} className="flex min-w-0 flex-wrap items-start gap-2 text-sm">
                  <span className="num text-base-content/70 w-14 shrink-0">{days[i + 1]}</span>
                  <span className={TILE}>
                    <FileText {...SMALL_ICON} />
                  </span>
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
          <p className={`${LABEL} flex items-center gap-2`}>
            <span className="rounded-field bg-primary/10 text-primary grid size-9 flex-none place-items-center">
              <Globe {...ICON} />
            </span>
            {copy("how.read.title")}
          </p>
          <span className="badge badge-ghost badge-sm">{copy("how.read.pages", { pages: e.pagesRead })}</span>
        </div>
        <div className="relative flex flex-col gap-2">
          <dl className="divide-base-300 flex flex-col divide-y">
            {rows.map(([label, value, from]) => (
              <div key={label} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className={SMALL}>{copy(label)}</dt>
                <dd className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{value}</span>
                  <span className="num text-base-content/70 flex items-center gap-1 text-xs">
                    {/* The board turns ArrowRight so "from this source" keeps one icon. */}
                    <ArrowRight {...SMALL_ICON} className="text-base-content/50 shrink-0 rotate-180" />
                    {from}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          {/* Beside the first fact on a wide card, as the board draws it; below the list on a phone. */}
          <span className="badge badge-outline badge-sm self-end sm:absolute sm:top-2 sm:right-0">
            <Pencil {...SMALL_ICON} />
            {copy("how.read.fix")}
          </span>
        </div>
        <div className={WELL}>
          <p className="text-sm font-semibold">{copy("how.read.held")}</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <Zap {...ICON} className="text-warning shrink-0" />
              <span className="min-w-0 flex-1">{copy("how.read.held.ai")}</span>
              <span className="badge badge-soft badge-primary badge-sm">{copy("how.read.held.free", { minutes: HOW_FACTS.fixMinutes })}</span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <List {...ICON} className="text-warning shrink-0" />
              <span className="min-w-0 flex-1">{copy("how.read.held.list")}</span>
              <span className="badge badge-soft badge-primary badge-sm">{copy("how.read.held.free", { minutes: HOW_FACTS.fixMinutes })}</span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <Clock {...ICON} className="text-base-content/70 shrink-0" />
              <span className="min-w-0 flex-1">{copy("how.read.held.slow", { count: e.slowPages })}</span>
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
          <p className="rounded-box bg-base-200 flex min-w-0 items-center gap-2 px-3 py-2 text-sm">
            <Search {...SMALL_ICON} className="shrink-0" />
            <Num phrase>{e.search}</Num>
          </p>
          <p className={SMALL}>{copy("how.rivals.first")}</p>
          <ol className="flex flex-col gap-2">
            {e.results.map((r) => (
              <li key={r.url} className="flex min-w-0 items-start gap-2">
                <span className="badge badge-ghost badge-sm shrink-0">{r.name.charAt(0)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{r.name}</span>
                  <span className="num text-base-content/70 text-xs">{r.url}</span>
                  <span className="text-primary text-sm">{r.title}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className={SMALL}>{copy("how.rivals.more", { n: HOW_FACTS.googleFirstPage - e.results.length })}</p>
          <p className="text-error flex items-center gap-1 text-sm font-semibold">
            <CircleX {...ICON} />
            {copy("how.rivals.missing", { business: e.business })}
          </p>
        </div>
      </div>
      <div className={CARD}>
        <div className="card-body gap-3">
          <p className={`${LABEL} flex items-center gap-1`}>
            <Sparkles {...ICON} />
            {copy("how.rivals.ai")}
          </p>
          <p className="rounded-box bg-base-200 self-end px-3 py-2 text-sm">{e.question}</p>
          <div className="rounded-box border-base-300 flex flex-col gap-2 border p-3">
            <p className={`${SMALL} flex items-center gap-1`}>
              <Sparkles {...SMALL_ICON} />
              {copy("how.rivals.answer")}
            </p>
            <p className="text-sm">{e.answer}</p>
            <p className="flex flex-wrap gap-1">
              {e.mentioned.map((domain) => (
                <span key={domain} className="badge badge-ghost badge-sm gap-1">
                  <Link {...SMALL_ICON} />
                  <Num>{domain}</Num>
                </span>
              ))}
            </p>
          </div>
          <p className="text-error flex items-center gap-1 text-sm font-semibold">
            <CircleX {...ICON} />
            {copy("how.rivals.absent", { business: e.business })}
          </p>
          <p className={SMALL}>{copy("how.rivals.tally", { n: e.tally.n, total: e.tally.total })}</p>
        </div>
      </div>
      <div className={`${CARD} md:col-span-2`}>
        <div className="card-body gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users {...ICON} />
            {copy("how.rivals.list.title")}
          </p>
          <ul className="flex flex-wrap gap-1">
            {e.watched.map((name) => (
              <li key={name} className="badge badge-ghost badge-sm">
                {name}
              </li>
            ))}
            <li className="badge badge-soft badge-primary badge-sm">
              {copy("how.rivals.list.more", { n: HOW_FACTS.rivals - e.watched.length })}
            </li>
          </ul>
          <p className={SMALL}>{copy("how.rivals.list.caption")}</p>
        </div>
      </div>
    </figure>
  );
}

/** `#questions`: the questions kept and the one skipped. */
export function QuestionList(e: Example): React.JSX.Element {
  return (
    <figure className={CARD}>
      <div className="card-body gap-3">
        <p className={`${LABEL} flex items-center gap-1`}>
          <MessageSquare {...ICON} />
          {copy("how.pick.list", { buyers: e.buyers })}
        </p>
        <p className={SMALL}>{copy("how.pick.keep")}</p>
        <ul className="divide-base-300 flex flex-col divide-y">
          {e.questions.map((q) => {
            const picked = q.reason !== "off";
            return (
              <li key={q.search} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-2">
                <span className={`flex min-w-0 flex-col ${picked ? "" : "text-base-content/70"}`}>
                  <Num phrase>{q.search}</Num>
                  <span className={SMALL}>{copy("how.pick.volume", { n: q.volume.toLocaleString("en-US") })}</span>
                  <span className="flex items-center gap-1 text-sm">
                    {picked ? <Info {...SMALL_ICON} className="shrink-0" /> : <Ban {...SMALL_ICON} className="shrink-0" />}
                    {copy(REASON_COPY[q.reason])}
                  </span>
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
        <a href="#pages" className="link link-primary text-sm">
          {copy("how.pick.caption")}
        </a>
        <p className={SMALL}>{copy("how.pick.real")}</p>
      </div>
    </figure>
  );
}

/** `#pages`: one week of pages, each on its own day. */
export function WeekOfPages(e: Example): React.JSX.Element {
  return WeekCard(
    e,
    <>
      <div className="mockup-browser border-base-300 min-w-0 border">
        <div className="mockup-browser-toolbar min-w-0">
          <div className="input w-full min-w-0">
            <span className="truncate">{`${e.blog}${e.pagePath}`}</span>
          </div>
        </div>
        <p className="border-base-300 border-t px-4 py-3 text-sm">{copy("how.week.address")}</p>
      </div>
      <p className={SMALL}>{copy("how.week.caption", { week: e.mail.week })}</p>
    </>
  );
}

/** One week of pages, the plan and its key, with what a page says under it. */
export function WeekCard(e: Example, foot: React.ReactNode): React.JSX.Element {
  const days = weekDays();
  return (
    <figure className={CARD}>
      <div className="card-body gap-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={LABEL}>{copy("how.week.name", { business: e.business })}</span>
          <span className={`num ${SMALL}`}>{weekSpan().range}</span>
          <span className="badge badge-soft badge-success badge-sm">{copy("how.week.auto")}</span>
          <span className={`${SMALL} flex items-center gap-1`}>
            <Search size={12} strokeWidth={1.75} aria-hidden />
            {copy("how.week.monday")}
          </span>
        </p>
        <ol className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {e.plan.map((day, i) =>
            day.kind === "skip" ? (
              <li key={days[i]} className="rounded-box border-base-300 flex min-w-0 flex-col gap-1 border border-dashed p-3">
                <span className="num text-base-content/70 text-xs">{days[i]}</span>
                <span className="text-base-content/70 text-sm">{copy("how.week.skip")}</span>
                <span className={SMALL}>{copy("how.week.skip.why")}</span>
              </li>
            ) : (
              <li
                key={days[i]}
                className={`rounded-box flex min-w-0 flex-col gap-2 border p-3 ${day.state === "waiting" ? "border-primary bg-primary/5" : "border-base-300"}`}
              >
                <span className="num text-base-content/70 text-xs">{days[i]}</span>
                <PageSketch primary={day.state === "waiting"} />
                <span className="badge badge-ghost badge-sm gap-1 self-start">
                  {day.kind === "update" ? <RefreshCw size={12} strokeWidth={1.75} aria-hidden /> : null}
                  {copy(day.kind === "new" ? "how.week.new" : "how.week.update")}
                </span>
                <span className="text-sm font-semibold">{day.title}</span>
                <span className={SMALL}>{day.reason}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1">
                  {day.state === "live" ? <LiveBadge at={LIVE_AT} /> : null}
                  {day.state === "planned" ? (
                    <span className="badge badge-ghost badge-sm gap-1">
                      <Calendar size={12} strokeWidth={1.75} aria-hidden />
                      {copy("how.week.planned")}
                    </span>
                  ) : null}
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
        <p className={`${SMALL} flex flex-wrap gap-x-4 gap-y-1`}>
          <span className="flex items-center gap-1">
            <CircleCheck size={12} strokeWidth={1.75} aria-hidden className="text-success" />
            {copy("how.week.legend.live")}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} strokeWidth={1.75} aria-hidden className="text-primary" />
            {copy("how.week.legend.emailed")}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} strokeWidth={1.75} aria-hidden />
            {copy("how.week.planned")}
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw size={12} strokeWidth={1.75} aria-hidden />
            {copy("how.week.legend.update")}
          </span>
        </p>
        {foot}
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
          <Lock {...SMALL_ICON} className="shrink-0" />
          <span className="truncate">{`${e.blog}${e.pagePath}`}</span>
        </div>
      </div>
      <div className="border-base-300 flex flex-col gap-3 border-t p-5">
        <p className={SMALL}>{copy("how.true.eyebrow", { business: e.business, place: e.place })}</p>
        <h3 className="text-lg font-semibold">{e.page.title}</h3>
        {e.page.paragraphs.map((parts) => (
          <p key={parts[0]?.text} className="flex flex-col gap-2 text-sm">
            {parts.map((part) =>
              part.source === null ? (
                <span key={part.text}>{part.text}</span>
              ) : (
                <span key={part.text} className="flex flex-col gap-1">
                  <span className="bg-primary/10 rounded px-1">{part.text}</span>
                  <span className="num text-primary flex items-center gap-1 text-xs">
                    <Link {...SMALL_ICON} className="shrink-0" />
                    {copy("how.read.from", { source: `${e.site}${part.source}` })}
                  </span>
                </span>
              )
            )}
          </p>
        ))}
        <p className="flex flex-col gap-1 text-sm">
          <s className="text-base-content/70">{e.page.never}</s>
          <span className="text-error flex items-center gap-1 text-xs font-semibold">
            <Ban {...SMALL_ICON} className="shrink-0" />
            {copy("how.true.never")}
          </span>
        </p>
        <span className="badge badge-success gap-1 self-start">
          <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
          {copy("how.true.passed", { checks })}
        </span>
        <ExampleLine />
      </div>
    </figure>
  );
}

/** `#found`, and the landing's step 3 without the linked count its board omits: the Monday email, framed as a phone. */
export function MondayEmail(e: Example, show: { linked: boolean } = { linked: true }): React.JSX.Element {
  const days = weekDays().map((day) => day.split(" ")[0] ?? day);
  const rows = e.plan.slice(0, 2).map((page, i) => ({
    page,
    head:
      i === 0
        ? copy("how.mail.row.new", { day: days[0] ?? "", time: LIVE_AT })
        : copy("how.mail.row.update", { day: days[1] ?? "", date: weekDate(1), time: LIVE_AT }),
    why: copy("how.mail.why", { why: e.mail.why[i] ?? "" }),
  }));
  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <div className="mockup-phone border-base-300 max-w-72">
        <div className="mockup-phone-camera" />
        {/* It scrolls, so a keyboard can reach it. */}
        <div
          role="region"
          aria-label={copy("how.mail.caption")}
          tabIndex={0}
          className="mockup-phone-display bg-base-100 flex flex-col gap-3 overflow-y-auto px-4 pt-12 pb-6 text-sm"
        >
          <p className={SMALL}>{copy("landing.mail.inbox")}</p>
          <p className="flex items-center gap-1 font-semibold">
            <Inbox {...ICON} />
            {copy("how.mail.subject")}
          </p>
          <p>{copy("how.mail.hi", { name: e.mail.name, week: e.mail.week, business: e.business })}</p>
          <p className="rounded-box bg-success/10 flex items-start gap-2 p-2 text-xs">
            <CircleCheck {...ICON} className="text-success shrink-0" />
            {copy("how.mail.calm", { time: LIVE_AT })}
          </p>
          <ul className="flex flex-col gap-1 font-semibold">
            <li>{copy("how.mail.live", { n: e.mail.live })}</li>
            <li>{copy("how.mail.planned", { n: e.mail.planned })}</li>
            {show.linked ? <li>{copy("how.mail.linked", { n: e.mail.linked, total: e.mail.live })}</li> : null}
          </ul>
          <p className={LABEL}>{copy("how.mail.pages")}</p>
          {rows.map((row) => (
            <p key={row.page.title} className={WELL}>
              <span className={SMALL}>{row.head}</span>
              <span className="text-xs font-semibold">{row.page.title}</span>
              <span className={SMALL}>{row.why}</span>
              <span className="text-primary text-xs font-semibold">
                {`${copy("overview.waiting.stop")} · ${copy("how.week.edit")}`}
              </span>
            </p>
          ))}
        </div>
      </div>
      <figcaption className={SMALL}>{copy("how.mail.caption")}</figcaption>
    </figure>
  );
}

/** `#found`: what the work aims at, drawn as an example and never as a result. */
export function WhatWeWorkToward(e: Example): React.JSX.Element {
  return (
    <figure className={CARD}>
      <div className="card-body gap-3">
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp {...ICON} />
            {copy("how.goal.title")}
          </span>
          <span className="badge badge-ghost badge-sm">{copy("how.goal.badge")}</span>
        </p>
        <p className={`${LABEL} flex items-center gap-1`}>
          <Search {...ICON} />
          {copy("how.goal.google", { search: e.goal.search })}
        </p>
        <ol className="flex flex-col gap-2">
          <li className="rounded-box border-primary flex min-w-0 items-start gap-2 border p-2">
            <span className="badge badge-primary badge-sm shrink-0">{e.business.charAt(0)}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{e.business}</span>
              <span className="text-base-content/70 font-mono text-xs break-all">{`https://${e.blog}`}</span>
              <span className="badge badge-soft badge-success badge-sm">{copy("how.goal.yours")}</span>
              <span className="text-primary text-sm">{e.page.title}</span>
            </span>
          </li>
          <li className="flex min-w-0 items-start gap-2 p-2">
            <span className="badge badge-ghost badge-sm shrink-0">{e.goal.below.name.charAt(0)}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{e.goal.below.name}</span>
              <span className="text-base-content/70 font-mono text-xs break-all">{`https://${e.goal.below.url}`}</span>
              <span className="text-primary text-sm">{e.goal.below.title}</span>
            </span>
          </li>
        </ol>
        <p className="text-success flex items-center gap-1 text-sm font-semibold">
          <CircleCheck {...ICON} />
          {copy("how.goal.first")}
        </p>
        <p className="rounded-box border-base-300 flex flex-col gap-1 border p-3 text-sm">
          <span className={`${LABEL} flex items-center gap-1`}>
            <Sparkles {...ICON} />
            {copy("how.rivals.ai")}
          </span>
          <span>{e.question}</span>
          <span>{e.goal.answer}</span>
          <span className="badge badge-ghost badge-sm gap-1">
            <Link {...SMALL_ICON} />
            <Num>{e.blog}</Num>
          </span>
          <span className="text-success font-semibold">{copy("how.goal.linked")}</span>
        </p>
        <figcaption className={SMALL}>{copy("how.goal.caption", { business: e.business })}</figcaption>
      </div>
    </figure>
  );
}

const WHEN = [
  ["first", Calendar],
  ["found", Search],
  ["showing", Eye],
  ["top", TrendingUp],
] as const;

/** One step of a timeline: when, what happens then, and its own icon, so no step borrows the tick of "Live". */
export interface WhenStep {
  readonly at: string;
  readonly what: string;
  readonly icon: LucideIcon;
}

export const WHEN_STEPS = (): readonly WhenStep[] =>
  WHEN.map(([step, icon]) => ({
    at: copy(`how.when.${step}.at` as CopyKey),
    what: copy(`how.when.${step}.what` as CopyKey),
    icon,
  }));

/** `#found`: what moves when, as time ranges and never as dates. Pricing
 *  draws the same card with its own first days and no Maps line. */
export function WhatToExpect(
  p: { title?: string; steps?: readonly WhenStep[]; maps?: boolean } = {}
): React.JSX.Element {
  const steps = p.steps ?? WHEN_STEPS();
  return (
    <div className={CARD}>
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">{p.title ?? copy("how.when.title")}</h3>
          <span className={SMALL}>{copy("how.when.sub")}</span>
        </div>
        <ul className="timeline timeline-vertical timeline-compact min-w-0">
          {steps.map((step, i) => (
            <li key={step.at}>
              {i > 0 ? <hr className="bg-base-300" /> : null}
              <div className="timeline-middle text-primary">
                <step.icon {...ICON} />
              </div>
              <div className="timeline-end mb-3 flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{step.at}</span>
                <span className="text-base-content/70 text-sm">{step.what}</span>
              </div>
              {i < steps.length - 1 ? <hr className="bg-base-300" /> : null}
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-sm font-semibold">
          <Info {...ICON} className="mt-0.5 shrink-0" />
          {copy("how.when.promise")}
        </p>
        {p.maps === false ? null : (
          <p className={`${SMALL} flex items-start gap-2`}>
            <MapPin {...ICON} className="shrink-0" />
            {copy("how.when.maps")}
          </p>
        )}
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
          <Timer {...ICON} />
          {copy("how.part.clock", { minutes: HOW_FACTS.setupMinutes })}
        </p>
        <ol className="steps steps-vertical min-w-0">
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="font-semibold">{copy("how.part.one")}</span>
              <span className={SMALL}>{copy("how.part.one.line")}</span>
            </span>
          </li>
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="flex flex-wrap items-center gap-1 font-semibold">
                <span className="badge badge-ghost badge-sm">{copy("how.part.optional")}</span>
                {copy("how.part.two")}
              </span>
              <span className={SMALL}>{copy("how.part.two.line")}</span>
            </span>
          </li>
          <li className="step step-primary">
            <span className="flex min-w-0 flex-col items-start text-start">
              <span className="font-semibold">{copy("how.part.three")}</span>
              <span className={SMALL}>{copy("how.part.three.line")}</span>
              <span className="flex flex-wrap gap-1">
                <span className="badge badge-ghost badge-sm gap-1">
                  <Link {...SMALL_ICON} />
                  {copy("how.part.pill.line")}
                </span>
                <span className="badge badge-ghost badge-sm gap-1">
                  <Plug {...SMALL_ICON} />
                  {copy("settings.destination.wordpress")}
                </span>
              </span>
            </span>
          </li>
        </ol>
        <p className="flex items-center gap-1 text-sm font-semibold">
          <ArrowDown {...ICON} />
          {copy("how.part.after")}
        </p>
        {waiting === undefined ? null : (
          <div className={WELL}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="num text-base-content/70 text-xs">{`${weekDays()[e.plan.indexOf(waiting)]} · ${LIVE_AT}`}</span>
              <span className="badge badge-soft badge-success badge-sm">{copy("how.part.page")}</span>
            </span>
            <span className="text-sm font-semibold">{e.partPage}</span>
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
            <span className={SMALL}>{copy("how.part.window", { hours: HOW_FACTS.windowHours })}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

/** `#start`, and every Learn page's close with its own caption: the three
 *  figures a free report opens on: the score in its ring, and an icon tile on each other figure. */
export function ReportGlance(e: Example, caption?: string): React.JSX.Element {
  return (
    <figure className={CARD} aria-label={copy("how.start.glance")}>
      <div className="card-body gap-3">
        <p className={LABEL}>{copy("how.start.glance")}</p>
        <div className="stats stats-vertical min-w-0">
          {/* Spans, so the score, its band and its name read as one line. */}
          <div className="stat px-0">
            <span
              aria-hidden
              className={`stat-figure ${SCORE_RING} [--size:4rem]`}
              style={{ "--value": e.report.score } as React.CSSProperties}
            />
            <span className="stat-value text-3xl">{copy("how.start.score", { score: e.report.score, max: 100 })}</span>
            <span className="stat-title text-base-content font-semibold">{copy("band.score.hard-to-find")}</span>
            <span className="stat-desc text-base-content/70 whitespace-normal">{copy("how.start.score.name")}</span>
          </div>
          <div className="stat px-0">
            <span aria-hidden className={`stat-figure ${ICON_TILE}`}>
              <Sparkles {...ICON} />
            </span>
            <div className="stat-desc text-base-content text-sm whitespace-normal">
              {copy("how.start.ai", { n: e.report.mentioned, total: e.report.asked })}
            </div>
            <progress aria-hidden className="progress progress-primary mt-2" value={e.report.mentioned} max={e.report.asked} />
          </div>
          <div className="stat px-0">
            <span aria-hidden className={`stat-figure ${ICON_TILE}`}>
              <FileText {...ICON} />
            </span>
            <div className="stat-desc text-base-content text-sm whitespace-normal">
              {copy("how.start.missing", { n: e.report.missing })}
            </div>
          </div>
        </div>
        <figcaption className={SMALL}>{caption ?? copy("how.start.caption", { business: e.business })}</figcaption>
      </div>
    </figure>
  );
}

