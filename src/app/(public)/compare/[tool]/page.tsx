// Issue 1458 — one comparison, at the address v1 and v2 published.
//
// The answer first, then what the other tool does well, what ReachKit does
// instead, the two side by side, when to pick which, the one call to scan,
// and where the facts about the other tool were read and when.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { publicMetadata } from "../../_seo/metadata";
import { JsonLd, articleSchemas, homeCrumb } from "../../_seo/structured";
import { COMPARISONS, comparisonOf, type Cell } from "../../_library";
import { BackLink, BODY, CARD, LIST, LearnClose, LearnLoop, LibraryPage, Sources, TextCard, Trademarks } from "../../_library/parts";

/** Every comparison is known at build; any other address is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): { tool: string }[] {
  return COMPARISONS.map((c) => ({ tool: c.slug }));
}

type Params = { params: Promise<{ tool: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool } = await params;
  const c = comparisonOf(tool);
  if (c === undefined) return {};
  return publicMetadata({
    seo: PUBLIC_ROUTE_SEO.comparison,
    path: `/compare/${c.slug}`,
    vars: { title: c.title, description: c.description },
  });
}

const EYEBROW: CopyKey = "compare.eyebrow";
const MORE: CopyKey = "compare.item.more";
const PAGE_TEST_ID = "comparison";
const INDEX = "/compare";

function CellText(p: { cell: Cell }): React.JSX.Element {
  if (p.cell === true) {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <Check size={16} strokeWidth={1.75} aria-hidden />
        {copy("compare.item.yes")}
      </span>
    );
  }
  if (p.cell === false) {
    return (
      <span className="text-base-content/70 inline-flex items-center gap-1">
        <X size={16} strokeWidth={1.75} aria-hidden />
        {copy("compare.item.no")}
      </span>
    );
  }
  return <span>{p.cell}</span>;
}

export default async function ComparisonPage({ params }: Params): Promise<React.JSX.Element> {
  const { tool } = await params;
  const c = comparisonOf(tool);
  if (c === undefined) notFound();

  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={c.title}>
      {/* Issue 1512: the date the page prints, and the links it draws. */}
      <JsonLd
        blocks={articleSchemas({
          path: `${INDEX}/${c.slug}`,
          headline: c.title,
          modified: c.checked,
          trail: [homeCrumb(), { name: copy("chrome.nav.compare"), path: INDEX }],
        })}
      />
      <p className="text-lg">{c.intro}</p>
      <TextCard heading={c.theirs.heading} paragraphs={c.theirs.paragraphs} />
      <TextCard heading={c.ours.heading} paragraphs={c.ours.paragraphs} />
      <LearnLoop />

      <section className={CARD}>
        <div className={BODY}>
          <h2>{copy("compare.item.table")}</h2>
          <table className="table table-sm w-full table-fixed">
            <thead className="text-base-content/70">
              <tr>
                <th scope="col" className="w-2/5 whitespace-normal break-words">
                  {copy("compare.item.feature")}
                </th>
                <th scope="col" className="whitespace-normal break-words">
                  {copy("chrome.wordmark")}
                </th>
                <th scope="col" className="whitespace-normal break-words">
                  {c.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="font-normal break-words">
                    {row.label}
                  </th>
                  <td className="break-words">
                    <CellText cell={row.reachkit} />
                  </td>
                  <td className="break-words">
                    <CellText cell={row.them} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <section className={CARD}>
          <div className={BODY}>
            <h2>{copy("compare.item.pick.them", { name: c.name })}</h2>
            <ul className={LIST}>
              {c.pickThem.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
        <section className={CARD}>
          <div className={BODY}>
            <h2>{copy("compare.item.pick.us")}</h2>
            <ul className={LIST}>
              {c.pickUs.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <LearnClose variant="compare-tool" />
      <Sources checked={c.checked} sources={c.sources} />
      <Trademarks />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
