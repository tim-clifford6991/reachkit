// Issue 1458 — the teardowns index, at the address v1 published, with its
// RSS feed beside it.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Rss } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { TEARDOWNS, longDate } from "../_library";
import { LibraryPage, ScanCta } from "../_library/parts";

const FEED = "/teardowns/rss.xml";
const head = staticMetadata(PUBLIC_ROUTE_SEO.teardowns);

/** The page's own head, with the feed announced beside its canonical. */
export const metadata: Metadata = {
  ...head,
  alternates: { ...head.alternates, types: { "application/rss+xml": FEED } },
};

const EYEBROW: CopyKey = "teardowns.eyebrow";
const PAGE_TEST_ID = "teardowns";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";

export default function TeardownsPage(): React.JSX.Element {
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("teardowns.title")} wide>
      <p className="max-w-(--w-read)">{copy("teardowns.lead")}</p>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEARDOWNS.map((t) => (
          <li key={t.slug} className="flex min-w-0">
            <Link href={`/teardowns/${t.slug}`} className={`${TILE} w-full min-w-0`}>
              <span className="card-body gap-2">
                <span className="card-title flex items-center justify-between gap-2 text-base">
                  <span className="min-w-0 break-words">{t.title}</span>
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                </span>
                <span className="text-base-content/70 font-mono text-xs">{longDate(t.revised)}</span>
                <span className="text-base-content/70 text-sm">{t.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <a href={FEED} className="link link-primary inline-flex items-center gap-1">
          <Rss size={16} strokeWidth={1.75} aria-hidden />
          {copy("teardowns.rss")}
        </a>
      </p>
      <ScanCta />
    </LibraryPage>
  );
}
