// The teardowns index, at the address v1 published: what every teardown
// reads, then one card per product with its sharpest promise marked. The RSS
// feed stays announced in the head, beside the canonical.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { TEARDOWNS, shortDate, type Teardown } from "../_library";
import { TEARDOWN_PARTS } from "../_library/types";
import { LearnClose, LibraryPage } from "../_library/parts";

const FEED = "/teardowns/rss.xml";
const head = staticMetadata(PUBLIC_ROUTE_SEO.teardowns);

/** The page's own head, with the feed announced beside its canonical. */
export const metadata: Metadata = {
  ...head,
  alternates: { ...head.alternates, types: { "application/rss+xml": FEED } },
};

const EYEBROW: CopyKey = "teardowns.eyebrow";
const PAGE_TEST_ID = "teardowns";
const ALL_ID = "all";
/** A reserved address (RFC 2606): the sketch stands for any product's home page. */
const ANY_SITE = "example.com";
const SMALL = "text-base-content/70 text-sm";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
const FRAME = "mockup-browser border-base-300 bg-base-200 min-w-0 border";
const LINE = "bg-base-300 block h-2 rounded-full";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";

/** The number a sketch marks a place with. */
function Mark(p: { n: number }): React.JSX.Element {
  return <span className="badge badge-outline badge-sm shrink-0">{p.n}</span>;
}

/** Two grey lines where a sketch has text it does not quote. */
function Lines(): React.JSX.Element {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden>
      <span className={`${LINE} w-3/4`} aria-hidden />
      <span className={`${LINE} w-1/2`} aria-hidden />
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
            <div className="input min-w-0 truncate font-mono text-xs">{ANY_SITE}</div>
          </div>
          <div className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
            <span className="flex min-w-0 items-center gap-3">
              <Mark n={1} />
              <Lines />
            </span>
            <span className="flex min-w-0 items-center gap-3">
              <Mark n={2} />
              <Lines />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Mark n={3} />
              <span className="badge badge-ghost">{copy("teardowns.reads.deadline")}</span>
              <span className="badge badge-ghost">{copy("teardowns.reads.side")}</span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Mark n={4} />
              <span className="badge badge-outline border-dashed">{copy("teardowns.reads.page")}</span>
            </span>
          </div>
        </div>
        <p className={LABEL}>{copy("teardowns.reads.title")}</p>
        <ol className="flex min-w-0 flex-col gap-3">
          {TEARDOWN_PARTS.map((part, i) => (
            <li key={part} className="flex min-w-0 items-start gap-3">
              <Mark n={i + 1} />
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
    <Link href={`/teardowns/${t.slug}`} className={`${TILE} w-full min-w-0`}>
      <span className="card-body gap-3">
        <span className={FRAME} aria-hidden>
          <span className="mockup-browser-toolbar">
            <span className="input min-w-0 truncate font-mono text-xs">{t.domain}</span>
          </span>
          <span className="bg-base-100 flex min-w-0 flex-col gap-2 p-3">
            <Lines />
            <span className="flex min-w-0 items-start gap-2">
              <Mark n={1} />
              <span className="min-w-0 text-sm font-semibold break-words">{t.hook}</span>
            </span>
          </span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-base-content/70 min-w-0 truncate font-mono text-xs">{t.domain}</span>
          <span className="badge badge-ghost badge-sm">{badgeOf(t)}</span>
        </span>
        <h3 className="card-title text-base break-words">{t.name}</h3>
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
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("teardowns.title")} wide>
      <section className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="max-w-(--w-read) text-lg">{copy("teardowns.lead")}</p>
          <p className={`${SMALL} flex items-center gap-2`}>
            <Eye size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {copy("teardowns.note")}
          </p>
        </div>
        <EveryRead />
      </section>
      <section className="mt-6 flex min-w-0 flex-col gap-4" aria-labelledby={ALL_ID}>
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
