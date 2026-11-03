// The teardowns index, at the address v1 published: what every teardown
// reads, then one card per product with its sharpest promise marked. The RSS
// feed stays announced in the head, beside the canonical.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Lock, RefreshCw, User } from "lucide-react";
import { SiteMark } from "@/ui/SiteMark";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { TEARDOWNS, shortDate, type Teardown } from "../_library";
import { TEARDOWN_PARTS } from "../_library/types";
import { BAND, LearnClose, LibraryPage } from "../_library/parts";

const FEED = "/teardowns/rss.xml";
const head = staticMetadata(PUBLIC_ROUTE_SEO.teardowns);

/** The page's own head, with the feed announced beside its canonical. */
export const metadata: Metadata = {
  ...head,
  alternates: { ...head.alternates, types: { "application/rss+xml": FEED } },
};

const PAGE_TEST_ID = "teardowns";
const ALL_ID = "all";
/** A reserved address (RFC 2606): the sketch stands for any product's home page. */
const ANY_SITE = "example.com";
const SMALL = "text-base-content/70 text-sm";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const FRAME = "mockup-browser border-base-300 bg-base-200 min-w-0 border";
const LINE = "bg-base-300 block h-2 rounded-full";
const SMALL_ICON = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const;
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";

/** The solid number a sketch marks a place with; the page it could add is green, a changed site warm. */
const MARK_TONE = {
  primary: "bg-primary text-primary-content",
  success: "bg-success text-success-content",
  warning: "bg-warning text-warning-content",
} as const;
function Mark(p: { n: number; tone?: keyof typeof MARK_TONE }): React.JSX.Element {
  return (
    <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${MARK_TONE[p.tone ?? "primary"]}`}>
      {p.n}
    </span>
  );
}

/** Where a card's promise sits: dashed and tinted, warm where the site changed. */
const PROMISE = {
  primary: "border-primary bg-primary/10",
  warning: "border-warning bg-warning/10",
} as const;

/** Two grey lines where a sketch has text it does not quote. */
function Lines(): React.JSX.Element {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden>
      <span className={`${LINE} w-3/4`} aria-hidden />
      <span className={`${LINE} w-1/2`} aria-hidden />
    </span>
  );
}

/** A sketch's address bar: one white pill holding the padlock and the address; daisyUI's toolbar input would paint a magnifier. */
function Address(p: { domain: string }): React.JSX.Element {
  return (
    <span className="bg-base-100 border-base-300 flex h-7 w-full min-w-0 items-center gap-1 rounded-full border px-3">
      <Lock {...SMALL_ICON} className="shrink-0" />
      <span className="min-w-0 truncate font-mono text-xs">{p.domain}</span>
    </span>
  );
}

/** A home page, sketched, with the four places every teardown reads. */
function EveryRead(): React.JSX.Element {
  return (
    <figure className={`${TILE} min-w-0`}>
      <div className="card-body gap-4">
        <div className={FRAME}>
          <div className="mockup-browser-toolbar">
            <Address domain={ANY_SITE} />
          </div>
          <div className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
            <span className="flex min-w-0 items-start gap-3">
              <Mark n={1} />
              <span className="flex min-w-0 flex-1 flex-col gap-2" aria-hidden>
                <span aria-hidden="true" className="bg-base-content/70 block h-3 w-5/6 rounded-full" />
                <span aria-hidden="true" className="bg-base-content/70 block h-3 w-1/2 rounded-full" />
                <span aria-hidden="true" className={`${LINE} w-2/3`} />
                <span className="flex gap-2">
                  <span aria-hidden="true" className="bg-primary/30 rounded-field block h-5 w-16" />
                  <span aria-hidden="true" className="border-base-300 rounded-field block h-5 w-12 border" />
                </span>
              </span>
            </span>
            <span className="grid min-w-0 grid-cols-3 gap-2" aria-hidden>
              <span className="rounded-field bg-base-200 flex p-2">
                <Lines />
              </span>
              <span className="rounded-field border-primary bg-primary/10 flex items-center gap-1.5 border border-dashed p-2">
                <Mark n={2} />
                <Lines />
              </span>
              <span className="rounded-field bg-base-200 flex p-2">
                <Lines />
              </span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Mark n={3} />
              <span className="badge badge-ghost">
                <User {...SMALL_ICON} />
                {copy("teardowns.reads.deadline")}
              </span>
              <span className="badge badge-ghost">{copy("teardowns.reads.side")}</span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Mark n={4} tone="success" />
              <span className="rounded-field border-success bg-success/10 text-base-content flex min-w-0 flex-1 items-center gap-1.5 border border-dashed px-3 py-2 text-xs font-semibold">
                <FileText {...SMALL_ICON} className="text-success shrink-0" />
                {copy("teardowns.reads.page")}
              </span>
            </span>
          </div>
        </div>
        <p className={LABEL}>{copy("teardowns.reads.title")}</p>
        <ol className="divide-base-300 flex min-w-0 flex-col divide-y">
          {TEARDOWN_PARTS.map((part, i) => (
            <li key={part} className="flex min-w-0 items-start gap-3 py-2.5">
              <Mark n={i + 1} tone={i === TEARDOWN_PARTS.length - 1 ? "success" : "primary"} />
              <span className="flex min-w-0 flex-col">
                <strong>{copy(`teardowns.reads.${part}` as CopyKey)}</strong>
                <span className={SMALL}>{copy(`teardowns.reads.${part}.line` as CopyKey)}</span>
              </span>
            </li>
          ))}
        </ol>
        <figcaption className={SMALL}>{copy("teardowns.reads.caption")}</figcaption>
      </div>
    </figure>
  );
}

/** "Revised 15 Oct 2026", or what changed since the first read. */
function badgeOf(t: Teardown): string {
  if (t.change !== undefined) return copy(`teardowns.card.change.${t.change}` as CopyKey);
  return copy("teardowns.card.revised", { date: shortDate(t.revised) });
}

function Card(p: { t: Teardown }): React.JSX.Element {
  const t = p.t;
  return (
    <Link href={`/teardowns/${t.slug}`} className={`${TILE} w-full min-w-0 overflow-hidden`}>
      <span className="bg-base-200 block px-3 pt-3" aria-hidden>
        <span className={`${FRAME} block rounded-b-none border-b-0`}>
          <span className="mockup-browser-toolbar">
            <Address domain={t.domain} />
          </span>
          <span className="bg-base-100 flex min-w-0 flex-col gap-2 p-3">
            <Lines />
            <span className={`rounded-field flex min-w-0 items-start gap-2 border border-dashed p-2 ${PROMISE[t.change === "site" ? "warning" : "primary"]}`}>
              <Mark n={1} tone={t.change === "site" ? "warning" : "primary"} />
              <span className="text-base-content min-w-0 text-sm font-semibold break-words">{t.hook}</span>
            </span>
            <Lines />
            <span aria-hidden className="bg-primary/30 rounded-field block h-5 w-16" />
          </span>
        </span>
      </span>
      <span className="card-body gap-3">
        <span className="badge badge-ghost badge-sm">
          {t.change === undefined ? <RefreshCw {...SMALL_ICON} /> : null}
          {badgeOf(t)}
        </span>
        <span className="flex min-w-0 items-center gap-2.5">
          <SiteMark domain={t.domain} hasLogo={false} size={36} />
          <h3 className="card-title text-base-content min-w-0 text-base font-bold break-words">{t.name}</h3>
        </span>
        <span className={SMALL}>{t.summary}</span>
        <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
          {copy("teardowns.card.read")}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export default function TeardownsPage(): React.JSX.Element {
  return (
    <LibraryPage testId={PAGE_TEST_ID} title={copy("teardowns.title")} wide>
      <section className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <p className="max-w-(--w-read) text-lg">{copy("teardowns.lead")}</p>
        <EveryRead />
      </section>
      <section className={`mt-6 flex min-w-0 flex-col gap-4 ${BAND}`} aria-labelledby={ALL_ID}>
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className={LABEL}>{copy("teardowns.count", { count: String(TEARDOWNS.length) })}</p>
            <h2 id={ALL_ID}>{copy("teardowns.item.more")}</h2>
          </div>
          <p className={`${SMALL} flex items-center gap-2`}>
            <Mark n={1} />
            <span>{copy("teardowns.legend")}</span>
          </p>
        </div>
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEARDOWNS.map((t) => (
            <li key={t.slug} className="flex min-w-0">
              <Card t={t} />
            </li>
          ))}
        </ul>
      </section>
      <LearnClose variant="teardowns" />
    </LibraryPage>
  );
}
