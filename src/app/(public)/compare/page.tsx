// The comparisons index, at the address v1 and v2 published: one sketched card
// per comparison under its kind. Static: the articles are data in `_library/`.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { cardLines, COMPARISONS, COMPARISON_GROUPS, type Comparison } from "../_library";
import { BAND, CompareCard, GROUP_ICON, LearnClose, LibraryPage, Tile, Trademarks, YourPart } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.compare);

const PAGE_TEST_ID = "compare";
const JUMP_ID = "compare-jump";
const TILE = "card bg-base-100 shadow-(--shadow-card)";
const SMALL = "text-base-content/70 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const ROW = "flex min-w-0 items-start gap-2 text-sm";

/** One comparison as one large card: a drawn sketch of the two tools side by side, never a logo or a screenshot. */
function ComparisonCard(p: { c: Comparison }): React.JSX.Element {
  const { c } = p;
  const lines = cardLines(c.summary);
  return (
    <Link href={`/compare/${c.slug}`} className={`${TILE} ${CARD_LIFT} w-full min-w-0 overflow-hidden`}>
      <figure className="bg-base-200 block px-3 pt-3" aria-hidden>
        <span className="mockup-browser border-base-300 bg-base-200 block min-w-0 rounded-b-none border border-b-0">
          <span className="mockup-browser-toolbar">
            <span className="min-w-0 truncate text-sm font-semibold">{c.name}</span>
          </span>
          <span className="bg-base-100 flex min-w-0 flex-col gap-2 p-3">
            <span className={ROW}>
              <span className="badge badge-ghost shrink-0">{c.name}</span>
              <span className="min-w-0 break-words">{lines.them}</span>
            </span>
            <span className={ROW}>
              <span className="badge badge-primary shrink-0">{copy("chrome.wordmark")}</span>
              <span className="min-w-0 break-words">{lines.us}</span>
            </span>
          </span>
        </span>
      </figure>
      <span className="card-body gap-3">
        <h3 className="card-title min-w-0 text-base break-words">{c.title}</h3>
        <span className={SMALL}>{lines.them}</span>
        <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-semibold">
          {copy("compare.card.read")}
          <ArrowRight {...ICON} className={ARROW_NUDGE} />
        </span>
      </span>
    </Link>
  );
}

export default function ComparePage(): React.JSX.Element {
  const groups = COMPARISON_GROUPS.map((g) => ({ ...g, entries: COMPARISONS.filter((c) => c.group === g.group) })).filter(
    (g) => g.entries.length > 0
  );
  return (
    <LibraryPage
      testId={PAGE_TEST_ID}
      title={copy("compare.title")}
      mark={copy("compare.title.mark")}
      lead={<p className="text-lg">{copy("compare.lead")}</p>}
      aside={<CompareCard />}
      wide
    >
      <nav aria-labelledby={JUMP_ID} className="flex min-w-0 flex-col gap-2" data-testid="compare-jump">
        <p id={JUMP_ID} className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
          {copy("compare.jump", { count: COMPARISONS.length })}
        </p>
        <div className="flex min-w-0 flex-wrap gap-2">
          {groups.map((g) => {
            const Icon = GROUP_ICON[g.group];
            return (
              <a key={g.group} href={`#${g.group}`} className="btn btn-ghost border-base-300 bg-base-100 min-h-11 rounded-full border text-sm">
                <Icon {...ICON} />
                {copy(g.name)} <span className="text-base-content/70">{g.entries.length}</span>
              </a>
            );
          })}
        </div>
      </nav>
      {groups.map((g, i) => (
        <section
          key={g.group}
          id={g.group}
          aria-labelledby={`${g.group}-h`}
          className={`flex min-w-0 scroll-mt-20 flex-col gap-3 ${i % 2 === 0 ? BAND : ""}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Tile Icon={GROUP_ICON[g.group]} />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={`${g.group}-h`}>
                {copy(g.name)} <span className="text-base-content/70 text-sm font-semibold">{g.entries.length}</span>
              </h2>
              <p className={SMALL}>{copy(g.line)}</p>
            </div>
          </div>
          <ul className="grid min-w-0 gap-4 md:grid-cols-2">
            {g.entries.map((c) => (
              <li key={c.slug} className="flex min-w-0">
                <ComparisonCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <YourPart />
      <LearnClose variant="compare" />
      <Trademarks />
    </LibraryPage>
  );
}
