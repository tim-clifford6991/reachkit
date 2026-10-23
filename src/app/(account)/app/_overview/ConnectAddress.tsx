// SPEC §5 (2026-09-20) — Overview while the customer's address waits for its
// DNS record, as board OverviewDNS draws it: the head, the one setting in
// three steps with its values and the check, other ways to connect, and the
// first page waiting to go live. No line names a go-live time (Q11).
import type React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { nameInZone } from "@/lib/publish/destinations/hosted/dns-guide";
import { CopyValue } from "../../_destination/CnameRecord";
import { dayKeyOf } from "../calendar/dates";
import { SETTINGS_TAB_HREF } from "../settings/tabs";
import { CheckNow } from "./CheckNow";
import type { AddressWaiting } from "./model";
import type { WaitingPage } from "./waiting";

const DAY_MS = 86_400_000;
const QUIET = "text-sm text-base-content/70";
const MARKER = "badge badge-primary size-7 shrink-0 font-bold";

/** The site-local day the screen is on, counted from the day the address was
 *  set up as day 1; `null` where that day is not known. */
function connectDay(since: Date | null, today: Date, timeZone: string): number | null {
  if (since === null) return null;
  const days = (Date.parse(dayKeyOf(today, timeZone)) - Date.parse(dayKeyOf(since, timeZone))) / DAY_MS;
  return Number.isFinite(days) && days >= 0 ? days + 1 : null;
}

function Step(p: { marker: React.ReactNode; title: string; line: string }): React.JSX.Element {
  return (
    <li className="flex min-w-0 items-start gap-3" data-testid="connect-step">
      <span className={MARKER}>{p.marker}</span>
      <span className="min-w-0 text-sm">
        <strong>{p.title}</strong>
        <br />
        <span className="text-base-content/70 wrap-anywhere">{p.line}</span>
      </span>
    </li>
  );
}

export function ConnectAddress(p: {
  connect: AddressWaiting;
  /** The first page, in review, or `null` before it is written. */
  page: WaitingPage | null;
  timeZone: string;
  today: Date;
}): React.JSX.Element {
  const { record } = p.connect;
  const dot = p.connect.hostname.indexOf(".");
  const label = p.connect.hostname.slice(0, dot);
  const domain = p.connect.hostname.slice(dot + 1);
  const day = connectDay(p.connect.since, p.today, p.timeZone);
  const fields = [
    { label: copy("setup.destination.guide.field.type"), value: record.type, name: copy("overview.connect.copy.type"), testId: "dns-type" },
    { label: copy("setup.destination.guide.field.name"), value: nameInZone(record.name, domain), name: copy("overview.connect.copy.name"), testId: "dns-name" },
    { label: copy("setup.destination.guide.field.value"), value: record.value, name: copy("overview.connect.copy.value"), testId: "dns-value" },
  ];

  return (
    <>
      <header className="flex min-w-0 flex-col gap-1" data-testid="overview-head">
        {day === null ? null : (
          <p className="eyebrow" data-testid="overview-day">
            {copy("overview.connect.day", { n: String(day) })}
          </p>
        )}
        <h1 className="min-w-0">{copy(p.page === null ? "overview.connect.head" : "overview.connect.head.ready")}</h1>
        <p className="min-w-0 text-base-content/70" data-testid="overview-head-note">
          {copy(p.page === null ? "overview.connect.lead" : "overview.connect.lead.ready")}
        </p>
      </header>

      <section className="card card-border min-w-0 bg-base-100" data-testid="overview-connect">
        <div className="card-body min-w-0 gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="eyebrow">{copy("overview.connect.eyebrow")}</p>
            <h2 className="card-title">{copy("overview.connect.title")}</h2>
          </div>

          <ol className="flex min-w-0 flex-col gap-3" data-testid="connect-steps">
            <Step marker={1} title={copy("overview.connect.step.open")} line={copy("overview.connect.step.open.line", { domain })} />
            <Step marker={2} title={copy("overview.connect.step.paste")} line={copy("overview.connect.step.paste.line")} />
            <Step
              marker={<Check aria-hidden size={16} strokeWidth={1.75} />}
              title={copy("overview.connect.step.rest")}
              line={copy("overview.connect.step.rest.line", { label })}
            />
          </ol>

          <dl
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-box bg-base-200 p-3 text-sm"
            data-testid="dns-record"
            data-host={record.name}
          >
            {fields.map((field) => (
              <div key={field.testId} className="contents">
                <dt className="text-base-content/70">{field.label}</dt>
                <dd className="num wrap-anywhere" data-testid={field.testId}>
                  {field.value}
                </dd>
                <dd>
                  <CopyValue text={field.value} name={field.name} />
                </dd>
              </div>
            ))}
          </dl>

          <CheckNow checkedAt={p.connect.checkedAt?.toISOString() ?? null} timeZone={p.timeZone} />

          <details className="collapse collapse-arrow min-w-0" data-testid="connect-other">
            <summary className="collapse-title px-0 text-sm font-semibold">{copy("overview.connect.other")}</summary>
            <div className={`collapse-content flex flex-col gap-2 px-0 ${QUIET}`}>
              <p>
                <span className="me-1">{copy("overview.connect.wordpress")}</span>
                <Link className="link link-primary" href={SETTINGS_TAB_HREF.publishing}>
                  {copy("overview.connect.wordpress.link")}
                </Link>
              </p>
              <p>{copy("overview.connect.later")}</p>
            </div>
          </details>
        </div>
      </section>

      {p.page === null ? null : (
        <section className="card card-border min-w-0 bg-base-100" data-testid="overview-waiting">
          <div className="card-body min-w-0 gap-4 p-4 sm:p-5 md:grid md:grid-cols-2 md:items-center">
            {/* The page as readers will see it; its words are said beside it. */}
            {p.page.readerHost === null && p.page.lead === "" ? null : (
              <div className="mockup-browser min-w-0 border border-base-300" aria-hidden data-testid="overview-waiting-preview">
                <div className="mockup-browser-toolbar">
                  <div className="input w-full min-w-0">
                    <span className="truncate">{p.page.readerHost ?? ""}</span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 p-4 text-sm">
                  <p className="font-semibold">{p.page.title}</p>
                  <p className="line-clamp-3 text-base-content/70">{p.page.lead}</p>
                </div>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-2">
            <p className="eyebrow">{copy("overview.connect.page.eyebrow")}</p>
            <p className="min-w-0 truncate font-semibold" title={p.page.title} data-testid="overview-waiting-title">
              {p.page.title}
            </p>
            <p className={QUIET}>{copy("overview.connect.page.line")}</p>
            <Link className="link link-primary self-start text-sm" href={p.page.href} data-testid="overview-waiting-read">
              {copy("overview.connect.page.read")}
            </Link>
            </div>
          </div>
        </section>
      )}

      <p className={QUIET} data-testid="overview-progress-later">
        {copy("overview.connect.progress")}
      </p>
    </>
  );
}
