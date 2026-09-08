// BUILD §4.1 module 5 — the free page card
//
// Page 1 of N: its title, the search it targets, the rival it beats, its
// format, and the one control that trades an email address for the
// finished draft. The draft itself is generated only *after* the address
// is submitted (§4.2) — this card offers the page, it does not contain it.
//
// The title is model text and reaches the screen only through
// `renderGenerated`, which cannot be called without the identity of the
// page the text belongs to and returns the label and the text together, so
// the card cannot show the title and drop the "proposed" label
// (REQ-093 c2).
//
// **The control is the outline secondary in accent, not the solid primary**
// (owner's ruling on issue #291). The report offers two things to do — take
// the free page, and start the subscription — and tokens.md §9.1 gives a
// screen one solid accent fill. The subscription is the one that keeps it
// (`pricing.tsx`), because it is what the screen is for; this card's control
// keeps the accent in its edge and ink, so it still reads as a call to
// action and not as an aside. It is the same `--accent`, spent as a border
// rather than a ground.
import type React from "react";
import { Badge, Btn, Card } from "@/ui/components";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { renderGenerated } from "@/lib/presentation/generated";
import type { FreePageSection } from "@/lib/scan/report";
import { Num } from "../_address/measured";

function Row(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-base-300 grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0">
      <dt className="text-xs opacity-60">{p.label}</dt>
      {/* The cell is a declared scroll container (issue #256, owner's ruling
          2026-09-07). A value is never broken mid-word — `.num` in
          `src/ui/type.css` — and the "beats" row's rival domain is one
          unbreakable token needing about 190px in a track that is about
          164px at the compact band. ADR-093's law is "content fits its box
          **or the box changes**", and `overflow-x-auto` is how this design
          system changes it: the wrap every registered `Table` carries, and
          the first row of the layout sweep's scroll-container allow-list.
          `min-w-0` beside it because a scroll container that cannot shrink
          below its content never scrolls — the defect `Table` records
          having been caught by the sweep at 320px. */}
      <dd className="min-w-0 overflow-x-auto">{p.children}</dd>
    </div>
  );
}

export function FreePageCard(p: { section: FreePageSection }): React.JSX.Element {
  const { section } = p;
  const title = renderGenerated(section.title, {
    state: "proposed",
    opportunityId: section.opportunityId,
    title: section.title,
    slug: section.slug,
  });

  return (
    <Card
      state="default"
      title={
        <CardHead
          eyebrow={copy("free-page.title")}
          pill={<Badge tone="accent">{copy("free-page.of", { total: String(section.totalPages) })}</Badge>}
        />
      }
    >
      <p className="text-xs opacity-60">{title.label}</p>
      <p className="font-bold">{title.text}</p>
      <dl className="flex flex-col">
        <Row label={copy("free-page.row.target")}>
          <Num>
            {copy("free-page.target.value", {
              keyword: section.target.keyword,
              volume: String(section.target.volume),
            })}
          </Num>
        </Row>
        <Row label={copy("free-page.row.beats")}>
          {section.beats === null ? (
            <span>{copy("place.report.first-page.rival")}</span>
          ) : (
            <Num>{section.beats}</Num>
          )}
        </Row>
        <Row label={copy("free-page.row.format")}>
          <Num>{section.format}</Num>
        </Row>
      </dl>
      <Btn label={copy("free-page.submit")} variant="secondary" tone="accent" block />
    </Card>
  );
}

/** REQ-004 c10/c11: a scan that found no opportunity says so in one
 *  written line rather than showing an empty card. */
export function FreePageAbsent(): React.JSX.Element {
  return <Card state="degraded" title={<CardHead eyebrow={copy("free-page.title")} />} degradedLine={copy("free-page.absent")} />;
}
