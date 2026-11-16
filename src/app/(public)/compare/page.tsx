// The comparisons index, at the address v1 and v2 published: one row per
// comparison under its kind. Static: the articles are data in `_library/`.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { cardLines, COMPARISONS, COMPARISON_GROUPS, type Comparison } from "../_library";
import { BAND, GROUP_ICON, LearnClose, LibraryPage, Tile, Trademarks } from "../_library/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.compare);

const PAGE_TEST_ID = "compare";
const JUMP_ID = "compare-jump";
const TILE =
  "card bg-base-100 shadow-(--shadow-card) motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5";
const SMALL = "text-base-content/70 text-sm";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** One comparison as one row: its title, what the other tool is, and the way in. */
function ComparisonCard(p: { c: Comparison }): React.JSX.Element {
  const { c } = p;
  return (
    <Link href={`/compare/${c.slug}`} className={`${TILE} w-full min-w-0`}>
      <span className="card-body flex-row items-center gap-3 p-4">
        <span className="avatar avatar-placeholder self-start" aria-hidden>
          <span className="bg-base-200 rounded-field grid size-9 place-items-center font-semibold">{c.name.charAt(0)}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="card-title min-w-0 text-base break-words">{c.title}</h3>
          <span className="text-base-content/70 text-sm">{cardLines(c.summary).them}</span>
        </span>
        <ArrowRight {...ICON} className="text-primary shrink-0" />
      </span>
    </Link>
  );
}

export default function ComparePage(): React.JSX.Element {
  const groups = COMPARISON_GROUPS.map((g) => ({ ...g, entries: COMPARISONS.filter((c) => c.group === g.group) })).filter(
    (g) => g.entries.length > 0
  );
  return (
    <LibraryPage testId={PAGE_TEST_ID} title={copy("compare.title")} wide>
      <p className="max-w-(--w-read)">{copy("compare.lead")}</p>
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
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.entries.map((c) => (
              <li key={c.slug} className="flex min-w-0">
                <ComparisonCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <LearnClose variant="compare" />
      <Trademarks />
    </LibraryPage>
  );
}
