// SPEC §2 and §4 (issue 1454) — what ReachKit read of the business, in one
// short card: its name, what it sells, what kind of business it is (issue
// 1470), who buys and where. The free report and the app's Overview draw
// this same card from the same reading
// (`src/lib/business/understanding.ts`), so they cannot say two things.
//
// In the app the card links to Settings, where the customer corrects what
// it says; that is their only control over what autopilot measures and
// writes from. A field nothing was read for says so in one quiet line.
import type React from "react";
import Link from "next/link";
import { COUNTRIES } from "@/lib/locale/locales";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { copy } from "@/lib/presentation/copy";

/** The most lines of what it sells, and of who buys, the card shows. */
const SHOWN = 3;

function whereLine(where: BusinessUnderstanding["where"]): string {
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

export function WhatWeRead(p: { understanding: BusinessUnderstanding; editHref?: string }): React.JSX.Element {
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
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0" data-testid="what-we-read">
      <div className="card-body gap-3">
        <h2 className="card-title">{copy("report.read.title")}</h2>
        <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-base-content/70">{row.label}</dt>
              <dd className={`min-w-0 break-words ${row.value === null ? "text-base-content/70" : ""}`}>{row.value ?? none}</dd>
            </div>
          ))}
        </dl>
        {p.editHref === undefined ? null : (
          <Link href={p.editHref} className="link link-primary text-sm">
            {copy("report.read.edit")}
          </Link>
        )}
      </div>
    </section>
  );
}
