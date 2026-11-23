// SPEC §4 (plates O4, O8) — On Google's detail: back to Overview, the tiles with this one current,
// the head and its pills, then each live page on its own search, then Against Competitors' card.
//
// **Every read is a stored one, and the tile's own**: the rows are the On Google tile's pages, split as
// the tile counts them, so the tile and the pills state one number. No measurement, vendor call or model
// call happens on render.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatShortDay, formatTime } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readPlanned } from "../../_overview/google-pages";
import { readRivals } from "../../_overview/rivals-provider";
import type { PresenceCard } from "../../_overview/rivals-model";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { GoogleFilter } from "../../_overview/GoogleFilter";
import { GoogleTable } from "../../_overview/GoogleTab";
import { loadShowAll, loadShowGoogle, OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";

/** /app/search's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.search.title") };

const INK = "text-base-content/70";

/** Against Competitors under the rows: the twelve's first-page count beside the competitor with the most, linking the full screen. */
function RivalsCard(p: { card: PresenceCard }): React.JSX.Element | null {
  const { card } = p;
  if (card.of === 0) return null;
  const k = formatCount(card.you.count);
  const m = formatCount(card.of);
  const top = card.noRival ? undefined : [...card.rivals].sort((a, b) => b.count - a.count)[0];
  return (
    <Link className={`card card-border min-w-0 bg-base-100 ${CARD_LIFT} hover:border-primary`} href="/app/rivals" prefetch={true} data-testid="google-rivals">
      <span className="card-body min-w-0 gap-1.5 p-4 sm:p-5">
        <span className="card-title text-base">{copy("google.rivals.title")}</span>
        <span className="break-words">
          {top === undefined ? copy("google.rivals.line.alone", { k, m }) : copy("google.rivals.line", { k, m, competitor: top.domain, n: formatCount(top.count) })}
        </span>
        <span className="flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
          {copy("google.rivals.all", { m })}
          <ArrowRight className={`size-4 ${ARROW_NUDGE}`} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export default async function SearchTabPage(p: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const params = await p.searchParams;
  const [shell, tiles, planned, rivals] = await Promise.all([readShell(), readTiles(0, false), readPlanned(), readRivals().catch(() => null)]);
  // Unread rows are an error, never the no-pages line.
  if (tiles === null) throw new Error("search: tiles unreadable");
  const { all } = loadShowAll(params);
  const { show } = loadShowGoogle(params);
  const tile = tiles.tiles.find((t) => t.key === "google");
  const { on, notYet, readAt } = tiles.search;
  const live = on.length + notYet.length;
  // Before the first pass no page is counted either way.
  const counted = tile?.of.kind === "count";
  const n = (k: number): string => (counted ? formatCount(k) : copy("unmeasured.dash"));
  const labels = {
    all: copy("overview.google.filter.all", { n: formatCount(live) }),
    showing: copy("overview.google.filter.on", { k: n(on.length) }),
    "not-yet": copy("overview.google.filter.not-yet", { m: n(notYet.length) }),
  };
  const rows = show === "showing" ? on : show === "not-yet" ? notYet : [...on, ...notYet];
  const next = shell.publishing.next;
  const read = readAt === null ? null : formatShortDay(new Date(readAt), shell.timeZone);

  return (
    <div className={OVERVIEW} data-testid="search-tab">
      <DetailTiles model={tiles} tab="google" />
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <TabHead title={copy("overview.google.title")} testId="search" lead={copy("overview.google.lead")} measured={null} />
        {live === 0 ? null : (
          <Suspense fallback={null}>
            <GoogleFilter labels={labels} />
          </Suspense>
        )}
      </div>
      {live === 0 ? (
        <p className={`max-w-prose ${INK}`} data-testid="google-none">
          {copy("overview.google.none")}
          {next === null ? null : ` ${copy("overview.google.none.next", { day: formatShortDay(next, shell.timeZone), time: formatTime(next, shell.timeZone) })}`}
        </p>
      ) : (
        <>
          {tile?.change?.kind === "unread" && read !== null ? (
            <p role="status" data-testid="google-unread">
              {copy("overview.google.unread", { date: read })}
            </p>
          ) : null}
          <GoogleTable
            rows={rows}
            all={all}
            next={formatShortDay(shell.nextDueOn, shell.timeZone)}
            planned={planned}
            empty={!counted ? copy("overview.google.empty.due", { date: formatShortDay(shell.nextDueOn, shell.timeZone) }) : copy(show === "not-yet" ? "overview.google.empty.not-yet" : "overview.google.empty.showing")}
            checked={read === null ? null : copy("overview.detail.checked", { date: read })}
          />
        </>
      )}
      {rivals === null ? null : <RivalsCard card={rivals.firstPage} />}
    </div>
  );
}
