// SPEC §2 and §4 (issue 1454) — what ReachKit read of the business, in one
// short card: its name, what it sells, what kind of business it is (issue
// 1470), who buys and where. The free report's closed section and the
// app's card draw the same facts from the same reading
// (`src/lib/business/understanding.ts`), so they cannot say two things.
//
// In the app the card links to Settings, where the customer corrects what
// it says; that is their only control over what autopilot measures and
// writes from. A field nothing was read for says so in one quiet line.
import type React from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { COUNTRIES } from "@/lib/locale/locales";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { copy } from "@/lib/presentation/copy";
import type { CorrectionOffer } from "@/lib/market/coherence/offer";

/** The most lines of what it sells, and of who buys, the card shows. */
const SHOWN = 3;

/** Where the business sells, in one line. */
export function whereLine(where: BusinessUnderstanding["where"]): string {
  const country = COUNTRIES[where.country].location;
  if (where.place !== null) return copy("report.read.where.local", { place: where.place.name });
  switch (where.reach) {
    case "national":
      return copy("report.read.where.national", { country });
    case "international":
      return copy("report.read.where.international");
    case "local":
      return copy("report.read.where.measured", { country });
    case null:
      // Issue 1470: a stored scan whose reach nothing stored decides.
      return copy("report.read.where.unread", { country });
  }
}

/** In the app: the other markets the site declares, where it declares any. */
export function AlsoServesNote(p: { n: number | undefined }): React.JSX.Element | null {
  const n = p.n ?? 0;
  if (n === 0) return null;
  return (
    <p className="text-sm text-base-content/70" data-testid="also-serves">
      {n === 1 ? copy("app.locale.also-serves.one") : copy("app.locale.also-serves", { n: String(n) })}
    </p>
  );
}

/** The five facts, one row each; a field nothing was read for says so. */
function Facts(p: { understanding: BusinessUnderstanding }): React.JSX.Element {
  const u = p.understanding;
  const none = copy("report.read.none");
  const rows: readonly { key: string; label: string; value: string | null }[] = [
    { key: "name", label: copy("report.read.name"), value: u.name },
    {
      key: "sells",
      label: copy("report.read.sells"),
      value: u.sells.length === 0 ? null : u.sells.slice(0, SHOWN).map((o) => o.category).join(" · "),
    },
    { key: "kind", label: copy("report.read.kind"), value: u.kind === null ? null : copy(`report.read.kind.${u.kind}`) },
    { key: "buyers", label: copy("report.read.buyers"), value: u.buyers.length === 0 ? null : u.buyers.slice(0, SHOWN).join(", ") },
    { key: "where", label: copy("report.read.where"), value: whereLine(u.where) },
  ];
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="text-base-content/70">{row.label}</dt>
          <dd className={`min-w-0 break-words ${row.value === null ? "text-base-content/70" : ""}`}>{row.value ?? none}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WhatWeRead(p: { understanding: BusinessUnderstanding; editHref?: string }): React.JSX.Element {
  const u = p.understanding;
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0" data-testid="what-we-read">
      <div className="card-body gap-3">
        <h2 className="card-title">{copy("report.read.title")}</h2>
        <Facts understanding={u} />
        {p.editHref === undefined ? null : <AlsoServesNote n={u.where.alsoServes} />}
        {p.editHref === undefined ? null : (
          <Link href={p.editHref} className="link link-primary text-sm">
            {copy("report.read.edit")}
          </Link>
        )}
      </div>
    </section>
  );
}

/** The free report's What we read: closed like its neighbours, saying whose
 *  reading it is, and while the correction is offered, a link up to the
 *  header's one control (2026-10-24 E32). */
export function ReadSection(p: { understanding: BusinessUnderstanding; correction: CorrectionOffer }): React.JSX.Element {
  const u = p.understanding;
  const subtitle = [u.name, u.kind === null ? null : copy(`report.read.as.kind.${u.kind}`), u.where.place?.name ?? null]
    .filter((part): part is string => part !== null && part !== "")
    .join(" · ");
  // A link inside <summary> is nested interactive, so it sits beside the
  // details, drawn over the summary's end, and the summary leaves it room.
  return (
    <div className="relative min-w-0">
      <details id="read" className="collapse collapse-arrow scroll-mt-20 rounded-none" data-testid="what-we-read">
        <summary
          className={`collapse-title min-h-0 px-px py-2 after:end-2 after:top-6 ${p.correction.offered ? "pe-48 sm:pe-64" : "pe-10"}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="rounded-field grid size-9 shrink-0 place-items-center bg-base-200">
              <Globe className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">{copy("report.read.title")}</h2>
              {subtitle === "" ? null : <p className="text-base-content/70 text-sm font-normal">{subtitle}</p>}
            </div>
          </div>
        </summary>
        <div className="collapse-content min-w-0 px-px">
          <Facts understanding={u} />
        </div>
      </details>
      {p.correction.offered ? (
        <a
          href="#read-as"
          className="link link-primary absolute end-10 top-2 inline-flex min-h-11 max-w-36 items-center text-end text-sm sm:max-w-none"
        >
          {copy("verdict.not-your-market")}
        </a>
      ) : null}
    </div>
  );
}
