// The owner's review screen: one card per paying site, its committed week,
// what was left out and why, and how each live page stands. Read-only.
import type React from "react";
import type { CommittedRow, NotChosenRow } from "@/lib/opportunities/review/week";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { LivePage, ReviewSite } from "./store";

const COL = "col";
const NONE = "—";
const TABLE = "table table-sm";
const NUM = "tabular-nums";

const LABEL: Record<Label, { key: CopyKey; badge: string }> = {
  working: { key: "review.label.working", badge: "badge badge-soft badge-success" },
  climbing: { key: "review.label.climbing", badge: "badge badge-soft badge-info" },
  too_early: { key: "review.label.too_early", badge: "badge badge-soft" },
  not_moving: { key: "review.label.not_moving", badge: "badge badge-soft badge-warning" },
};
const UNMEASURED_BADGE = "badge badge-ghost";

function cell(value: string | number | null): string {
  return value === null ? NONE : String(value);
}

function Head(p: { cols: readonly CopyKey[] }): React.JSX.Element {
  return (
    <thead className="text-base-content/70">
      <tr>
        {p.cols.map((key) => (
          <th key={key} scope={COL}>
            {copy(key)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** A table wider than its card scrolls inside its own box, reachable from a keyboard. */
function Scroll(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label={p.label}>
      {p.children}
    </div>
  );
}

function Committed(p: { rows: readonly CommittedRow[] }): React.JSX.Element {
  const label = copy("review.week.title");
  return (
    <Scroll label={label}>
      <table className={TABLE} data-testid="review-week">
        <Head
          cols={[
            "review.col.place",
            "review.col.day",
            "review.col.search",
            "review.col.type",
            "review.col.fit",
            "review.col.volume",
            "review.col.points",
            "review.col.rule",
            "review.col.write-as",
          ]}
        />
        <tbody>
          {p.rows.map((row) => (
            <tr key={row.place}>
              <td className={NUM}>{row.place}</td>
              <td className="whitespace-nowrap">{row.day ?? copy("review.spare")}</td>
              <td className="font-mono break-words">{cell(row.search)}</td>
              <td>{row.type}</td>
              <td className={NUM}>{cell(row.fit)}</td>
              <td className={NUM}>{cell(row.volume)}</td>
              <td>
                <span className="flex flex-col gap-1">
                  <span className={NUM}>{cell(row.points)}</span>
                  <span className="flex flex-wrap gap-1">
                    {row.parts.map((part) => (
                      <span key={part.part} className="badge badge-soft badge-primary badge-sm">{`${part.part} ${part.n}`}</span>
                    ))}
                  </span>
                </span>
              </td>
              <td>{cell(row.rule)}</td>
              <td>{cell(row.writeAs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

function NotChosen(p: { rows: readonly NotChosenRow[] }): React.JSX.Element {
  const title = copy("review.rejected.title", { count: String(p.rows.length) });
  return (
    <details className="collapse collapse-arrow min-w-0 rounded-none">
      <summary className="collapse-title min-h-0 p-0 pe-10 text-sm font-medium">{title}</summary>
      <div className="collapse-content min-w-0 px-0 pt-2">
        <Scroll label={title}>
          <table className={TABLE}>
            <Head cols={["review.col.search", "review.col.type", "review.col.fit", "review.col.volume", "review.col.reason"]} />
            <tbody>
              {p.rows.map((row, n) => (
                <tr key={n}>
                  <td className="font-mono break-words">{cell(row.search)}</td>
                  <td>{row.type}</td>
                  <td className={NUM}>{cell(row.fit)}</td>
                  <td className={NUM}>{cell(row.volume)}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </div>
    </details>
  );
}

function Pages(p: { pages: readonly LivePage[] }): React.JSX.Element {
  if (p.pages.length === 0) return <p className="text-sm text-base-content/70">{copy("review.pages.empty")}</p>;
  return (
    <ul className="list min-w-0">
      {p.pages.map((page) => {
        const label = page.label === null ? null : LABEL[page.label];
        return (
          <li key={page.id} className="list-row items-baseline">
            <span className="list-col-grow min-w-0 font-mono text-sm break-all">{page.url}</span>
            <span className={label?.badge ?? UNMEASURED_BADGE}>{copy(label?.key ?? "review.label.unmeasured")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Site(p: { site: ReviewSite }): React.JSX.Element {
  const { week } = p.site;
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="review-site">
      <div className="card-body min-w-0 gap-4 p-4">
        <h2 className="card-title font-mono text-base break-all">{p.site.domain}</h2>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="eyebrow">{copy("review.week.title")}</h3>
          {week.committed.length === 0 ? (
            <p className="text-sm text-base-content/70">{copy("review.week.empty")}</p>
          ) : (
            <Committed rows={week.committed} />
          )}
          {week.rejected.length === 0 ? null : <NotChosen rows={week.rejected} />}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="eyebrow">{copy("review.pages.title")}</h3>
          <Pages pages={p.site.pages} />
        </div>
      </div>
    </section>
  );
}

/** `sites` is `null` where they could not be read. */
export function Review(p: { sites: readonly ReviewSite[] | null }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="review">
      <header className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{copy("review.eyebrow")}</span>
        <h1 className="text-2xl font-semibold">{copy("review.title")}</h1>
        <p className="text-sm text-base-content/70">{copy("review.lead")}</p>
      </header>
      {p.sites === null ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("review.unreadable")}
        </div>
      ) : p.sites.length === 0 ? (
        <p className="text-sm text-base-content/70">{copy("review.no-sites")}</p>
      ) : (
        p.sites.map((site) => <Site key={site.id} site={site} />)
      )}
    </div>
  );
}
