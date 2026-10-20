// Issue 1458 — the comparisons index, at the address v1 and v2 published.
//
// One card per comparison, under its kind of tool, each linking to the page
// Google still ranks. Static: the articles are data in `_library/`.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { COMPARISONS, COMPARISON_GROUPS, longDate } from "../_library";
import { LibraryPage, ScanCta, Trademarks } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.compare);

const EYEBROW: CopyKey = "compare.eyebrow";
const PAGE_TEST_ID = "compare";
/** The latest day the facts behind the cards were read. */
const READ_ON = COMPARISONS.map((c) => c.checked).sort().at(-1) ?? "";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";

export default function ComparePage(): React.JSX.Element {
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("compare.title")} wide>
      <p className="max-w-(--w-read)">{copy("compare.lead")}</p>
      <p className="text-base-content/70 max-w-(--w-read) text-sm" data-testid="compare-caption">
        {copy("compare.caption", { date: longDate(READ_ON) })}
      </p>
      {COMPARISON_GROUPS.map(({ group, name }) => {
        const entries = COMPARISONS.filter((c) => c.group === group);
        if (entries.length === 0) return null;
        return (
          <section key={group} className="flex min-w-0 flex-col gap-3">
            <h2>{copy(name)}</h2>
            <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((c) => (
                <li key={c.slug} className="flex min-w-0">
                  <Link href={`/compare/${c.slug}`} className={`${TILE} w-full min-w-0`}>
                    <span className="card-body gap-2">
                      <span className="card-title flex items-center justify-between gap-2 text-base">
                        <span className="min-w-0 break-words">{c.title}</span>
                        <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                      </span>
                      <span className="text-base-content/70 text-sm">{c.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <ScanCta />
      <Trademarks />
    </LibraryPage>
  );
}
