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
// **The control is solid, and so is the pricing card's** — ruling 2b of
// 2026-09-08 (`docs/design/approved/full-set/UI-SPEC.md` §1): "two solid
// primaries per screen are allowed where the artifact draws them (…
// report: Email me + Start)", which supersedes the master's rulings #290
// and #291. The report is the one screen with two trades on it — the page
// it gives away and the subscription — and the owner's own drawing puts a
// filled control on each. Every *other* rank rule stands: the outline
// secondary is still what a call to action that is not one of these two
// takes, and no third solid appears on this screen.
//
// **The field beside it asks for an address and nothing else** (REQ-010
// c1): no account, no password, no payment, no second field. The card is
// the set's `.card-accent` — the one card the screen is built around,
// ringed rather than filled.
import type React from "react";
import { FileText } from "lucide-react";
import { Badge, Btn, Card, Input } from "@/ui/components";
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
      accent
      title={
        <CardHead
          // `cardHead('file', 'Your first page', …)` — the set's own glyph.
          icon={<FileText size={15} strokeWidth={1.8} aria-hidden />}
          eyebrow={copy("free-page.title")}
          pill={<Badge tone="accent">{copy("free-page.badge")}</Badge>}
        />
      }
    >
      <p className="t-explain opacity-60">{title.label}</p>
      {/* The page's own title, at the card-head rung of the ladder — the
          one headline this module carries (UI-SPEC S2). */}
      <h3>{title.text}</h3>
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
      {/* REQ-010 c1's one control, and the field it needs. They sit on one
          row from `--breakpoint-sm` up and stack below it, which is the
          set's own `.field` — a wrapping flex row, not a grid. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label={copy("free-page.email.label")}
            placeholder={copy("free-page.email.placeholder")}
            name="email"
            type="text"
          />
        </div>
        <Btn label={copy("free-page.submit")} variant="primary" pill />
      </div>
      {/* "That's page 1 of N we found for you." — the total the card
          carries, in its own sentence rather than as a bare figure. */}
      {/* A mono phrase: a sentence with a count inside it, which wraps at
          its spaces like any other line. */}
      <p className="t-explain opacity-60">
        <Num phrase>{copy("free-page.of", { total: String(section.totalPages) })}</Num>
      </p>
    </Card>
  );
}

/** REQ-004 c10/c11: a scan that found no opportunity says so in one
 *  written line rather than showing an empty card. */
export function FreePageAbsent(): React.JSX.Element {
  return <Card state="degraded" title={<CardHead eyebrow={copy("free-page.title")} />} degradedLine={copy("free-page.absent")} />;
}
