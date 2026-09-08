// BUILD §4.1 module 2, right card — Google search
//
// Occupancy over the searches actually measured — the customer's bar in
// the accent, every rival's in neutral grey, each direct-labelled with its
// name and its value — and beneath a divider, the five biggest searches
// the customer is absent from.
//
// **Rivals are context, never alarms** (`BUILD.md` §2.5): no rival bar is
// ever red, and `PresenceSection` has no member a size, a forecast or a
// severity could travel in, so the promise holds by there being nowhere to
// put a violation.
//
// **No market-total footnote.** The owner removed it on 2026-09-03, both
// halves; `PresenceSection` carries no `totalMonthlyVolume` and no sum
// over the selected searches' volumes exists anywhere in this file. The
// `/mo` column of the absent-from table is each listed search's own
// volume, which §4.1 states as a column of that table.
//
// **The occupancy is `PresenceBars`** (issue #352, the approved
// `walk/report` drawing). §2.4's closed inventory owns this drawing, and
// it arrived here as an absent-safe `bars` slot that nothing ever filled —
// so the card drew the same rows by hand out of the registered `Progress`
// instead, which carries **one** tone: every rival's bar was painted in
// the customer's own accent, and §2.5's "rival strength is neutral gray,
// never red — rivals are context, not alarms" held only because the third
// colour it forbids was not the one being spent. `PresenceBars` reads its
// colour from `SERIES_COLOR` by identity and by nothing else, so the
// customer is `--chart-you` and every rival `--chart-rival` by
// construction, and every bar still carries its own name and its own value
// beside it (§2.4: "identity is never colour-alone").
//
// A zero is a measurement: the chart draws it as a hairline stub with the
// `0` written beside it, never as an absent row (§6.6).
import type React from "react";
import { Badge, Card, Divider, Table } from "@/ui/components";
import { PresenceBars } from "@/ui/charts";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import type { PresenceSection } from "@/lib/scan/report";
import { Num } from "../_address/measured";

export function GooglePresenceCard(p: {
  section: PresenceSection;
  /** The date the SERPs behind this card were read, already formatted by
   *  the caller that owns the report's one date. The drawing puts it at
   *  the foot of this card, where the left card puts its method line. */
  measuredOn: string;
}): React.JSX.Element {
  const { section } = p;

  return (
    <Card
      state="default"
      title={
        <CardHead
          eyebrow={copy("presence.title")}
          pill={<Badge tone="neutral">{copy("presence.source")}</Badge>}
        />
      }
    >
      {/* The card leads with its answer (§2.5), at the same `--t-h3` rung
          its neighbour's verdict takes. */}
      <h3>
        {copy("presence.occupancy", {
          you: String(section.you.top10Count),
          measured: String(section.measuredSearches),
        })}
      </h3>

      {/* REQ-092: a domain with no rivals to draw says so in writing where
          the bars would be, rather than drawing a chart of one bar and
          calling it a comparison. The customer's own count is already the
          line above. */}
      {section.framing === "suppressed_no_rivals" ? (
        <p>{copy("presence.no-rivals")}</p>
      ) : (
        // A declared scroll container, for the same reason the matrix has
        // one: the drawing fills the box it is given, and a box that
        // cannot shrink below its content never scrolls.
        <div className="min-w-0 overflow-x-auto">
          <PresenceBars
            you={{ name: section.you.domain, value: section.you.top10Count }}
            rivals={section.rivals.map((rival) => ({
              name: rival.domain,
              value: rival.top10Count,
            }))}
            measured={section.measuredSearches}
            label={copy("presence.title")}
          />
        </div>
      )}
      <p className="text-xs opacity-60">{copy("presence.legend")}</p>

      <Divider />

      {/* The eyebrow rung, not `--t-h3`: a label for a list inside a card
          is not a second card head (§2.3). */}
      <h3 className="eyebrow">{copy("presence.absent-from.title")}</h3>
      {/* The three columns, sized rather than left to chance (issue #307).
          The card is half the report's width at 1024 and 1280, and three
          mono columns that could none of them fold added up to more than
          it had: the wrap scrolled and the rival column was clipped
          mid-domain (`rival-one.example.n…`).

          The volume is a count and the holder is a domain — both single
          values, and both end up exactly as wide as they need, because a
          value never folds and the auto table algorithm therefore cannot
          make them narrower. The search is the one column that is
          language: §2.3 puts a query in the mono face, and a query is
          several words, so it folds at its spaces (`Num`'s `phrase`) and
          takes whatever is left.

          **Pinning the two value columns to `max-content` is what broke
          it**, and the first attempt here did exactly that: a pinned
          column takes its *header's* width too, so the volume column —
          whose numbers are 32px wide — was held at 119px by an unwritten
          `TODO(copy)` header, and the table came to 455px in a 430px card
          at 1024. Unpinned, with a header that may fold and a query that
          may fold, the same three columns settle at 380px. The layout
          algorithm was already able to do this; what it needed was to be
          allowed to.

          At the compact band the sum still exceeds the card, and the
          registered `Table`'s own `overflow-x-auto` carries it — which is
          the right answer there and the reason this needed no media
          query. */}
      <Table
        zebra
        columns={[
          { key: "search", header: copy("presence.absent-from.column.search") },
          { key: "volume", header: copy("presence.absent-from.column.volume") },
          { key: "holder", header: copy("presence.absent-from.column.holder") },
        ]}
        rows={section.absentFrom.map((row) => ({
          search: <Num phrase>{row.keyword}</Num>,
          volume: <Num>{row.volume}</Num>,
          holder: row.topHolder === null ? <span>{copy("place.report.first-page.rival")}</span> : <Num>{row.topHolder}</Num>,
        }))}
        emptyMessage={copy("presence.absent-from.empty")}
      />
      {/* The drawing's last line on this card: when these SERPs were read.
          The same key the verdict strip resolves it from — one fact, one
          home — and no market-total footnote above it: the owner removed
          that on 2026-09-03, both halves. */}
      <p className="text-xs opacity-60">
        <Num>
          {copy("report.measured-at", { domain: section.you.domain, date: p.measuredOn })}
        </Num>
      </p>
    </Card>
  );
}

/** REQ-004 c10/c11: named as absent in one written line; the rest of the
 *  report stays usable. */
export function GooglePresenceAbsent(): React.JSX.Element {
  return <Card state="degraded" title={<CardHead eyebrow={copy("presence.title")} />} degradedLine={copy("presence.absent")} />;
}
