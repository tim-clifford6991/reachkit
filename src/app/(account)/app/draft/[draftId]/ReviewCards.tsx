// SPEC §7 (2026-09-20, #908) · issue #931 — the three cards beside the page.
//
// "…with beside it: why this page; **how it appears in search results**;
// ***written from your business*** — each fact, quote and promise used and
// where it was read; **what gets published** (address, title, description,
// structured data, links, length); the checks."
//
// *Why this page* is `TargetBlock`'s and the checks are `DecidePanel`'s, both
// already on this screen. The three here are the ones §7 names that nothing
// drew: what a search result looks like, what the page stands on, and what
// actually leaves the building.
//
// daisyUI in the route: `card`, `card-body`, `list`, `list-row`, `badge`,
// `link`. lucide at 1.75. No library added and no stylesheet.
//
// **Every one of them states a fact the screen already holds.** Nothing here
// reads, derives a measurement or asks a model: the search result is the
// title and description the customer can edit, *written from* is
// `drafts.meta` as generation recorded it, and *what gets published* counts
// the body in front of it. A card with nothing to say is absent rather than
// empty.
//
// **Nothing here is a scroller.** A passage is prose and folds; an address is
// a value and carries `.num`, so where it will not fit the box grows taller
// (`src/ui/type.css` states that rule and why).
import type React from "react";
import { FileText, Quote, Search } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenFromIsEmpty, type Publisher, type WrittenFrom } from "./model";

/** The eyebrow every card on this screen heads itself with. Matches the
 *  rows already on it rather than minting a second heading style. */
const CARD_HEAD = "eyebrow flex items-center gap-2";

/**
 * An address as a reader reads it: the host and the path, with the scheme
 * dropped — the same spelling a search result's own address line uses and
 * the same one the page frame's bar draws.
 *
 * **The host is kept.** It was the path alone for a while, which read as
 * `/pricing/crm` on a *Written from* row and so said nothing about whose
 * page the sentence was read off — the one thing that row exists to say.
 * Nothing is shortened, because the whole of it is the value.
 */
function readableAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/** A declared scroll box for a value that may not fit its column.
 *
 *  `src/ui/type.css`: an address is a value, and a value is never rewritten
 *  to fit — "the *box* changes, with the `overflow-x-auto` wrap" (ADR-093),
 *  which is the one scroll container `tests/ui/layout/checks.ts`
 *  allow-lists. `tabIndex` only where nothing inside it already takes
 *  focus: a scroller a mouse can reach and a keyboard cannot is its own axe
 *  failure (`scrollable-region-focusable`), and a second tab stop around a
 *  link is noise. */
const VALUE_BOX = "min-w-0 max-w-full overflow-x-auto";

/**
 * How the page appears in a search result.
 *
 * The three things a result is made of and nothing else: the address, the
 * title, the description. Drawn in a result's own order — address above,
 * title as the link, description under it — so the customer reads the thing
 * a searcher will read rather than three form fields.
 *
 * **It is a rendering of their own text, not a judgement of it.** No length
 * warning, no score, no "too long": the editor is where a length count
 * belongs (SPEC §7's editor line), and a verdict here would be this
 * product's opinion dressed as a preview.
 */
export function SearchResultCard(p: {
  title: string;
  description: string;
  publisher: Publisher;
}): React.JSX.Element {
  return (
    <section
      className="card card-border bg-base-100 min-w-0"
      data-testid="draft-search-result"
    >
      <div className="card-body min-w-0 gap-3">
        <h2 className={CARD_HEAD}>
          <Search size={20} strokeWidth={1.75} aria-hidden />
          {copy("draft.search-result.title")}
        </h2>

        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={`num text-xs text-base-content/60 ${VALUE_BOX}`}
            tabIndex={0}
          >
            {readableAddress(p.publisher.url)}
          </span>
          {/* The title as a result draws it: the one blue line. Not a link —
              there is nowhere to send a reviewer, and a dead link in a
              preview reads as a broken page. */}
          <span
            className="text-primary text-lg wrap-anywhere"
            data-testid="search-result-title"
          >
            {p.title}
          </span>
          {p.description === "" ? null : (
            <span
              className="text-sm text-base-content/70 wrap-anywhere"
              data-testid="search-result-description"
            >
              {p.description}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Written from your business.
 *
 * #931's done-when: "every sentence about the business on the page appears in
 * the *Written from* card **with its source**." So each fact is its passage
 * and the page it was read from, and the address is a link — that is the
 * whole promise of the card, and the only one on this screen a customer can
 * follow to check us.
 *
 * The profile items are listed beside them: what the business does, sells,
 * promises, serves and says, as the prompt carried it (#927). They have no
 * address, and that is not a gap — their source is the customer, who
 * confirmed every one of them on Settings › Your business.
 *
 * **A draft written before generation recorded this draws no card.** An
 * empty one would say "this page stands on nothing", which is false: it
 * stands on facts nobody wrote down at the time.
 */
export function WrittenFromCard(p: {
  writtenFrom: WrittenFrom;
}): React.JSX.Element | null {
  if (writtenFromIsEmpty(p.writtenFrom)) return null;
  const { facts, profileItems } = p.writtenFrom;

  return (
    <section
      className="card card-border bg-base-100 min-w-0"
      data-testid="draft-written-from"
    >
      <div className="card-body min-w-0 gap-3">
        <h2 className={CARD_HEAD}>
          <Quote size={20} strokeWidth={1.75} aria-hidden />
          {copy("draft.written-from.title")}
        </h2>
        <p className="text-sm text-base-content/70 wrap-anywhere">
          {copy("draft.written-from.lead")}
        </p>

        {facts.length === 0 ? null : (
          <ul
            className="list bg-base-100 min-w-0 rounded-box"
            data-testid="written-from-facts"
          >
            {facts.map((fact) => (
              // **`list-col-grow` and `list-col-wrap`, not `flex-col`.**
              // `.list-row` is a *grid* with `minmax(0,auto) 1fr` columns
              // (daisyUI's `list.css`), so `flex-col` set a flex direction
              // on a grid and changed nothing: the passage took the auto
              // column, the address was handed a 0-width one and its text
              // overflowed the card — a sideways document scroll at 390 and
              // 768, which is exactly what `docs/DESIGN.md`'s no-overflow
              // rule forbids. These two are the component's own way of
              // saying "one wide column, and this part on the next line".
              <li className="list-row min-w-0" key={fact.passage}>
                <span className="list-col-grow min-w-0 text-sm wrap-anywhere">
                  {fact.passage}
                </span>
                {fact.url === null ? (
                  // A draft written before the source was recorded (#927's
                  // first shape). The sentence is still what the page stands
                  // on, so it is listed and said to be unsourced rather than
                  // dropped — which is what this card is for.
                  //
                  // `/70`, not `/50`: the owner's ruling of 2026-09-22
                  // (#946) took every thinned arm off the floor, and half an
                  // ink is under 4.5:1 whatever the ink is. This is the same
                  // quiet colour the two lines above it take.
                  <span className="list-col-wrap min-w-0 text-xs text-base-content/70 wrap-anywhere">
                    {copy("draft.written-from.source-unknown")}
                  </span>
                ) : (
                  <span className={`list-col-wrap ${VALUE_BOX}`}>
                    <a
                      className="link link-hover num text-xs"
                      href={fact.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {readableAddress(fact.url)}
                    </a>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {profileItems.length === 0 ? null : (
          <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-3">
            <h3 className="eyebrow">{copy("draft.written-from.profile")}</h3>
            <div
              className="flex min-w-0 flex-wrap gap-2"
              data-testid="written-from-profile"
            >
              {profileItems.map((item) => (
                <span
                  className="badge badge-ghost h-auto max-w-full min-w-0 py-1 whitespace-normal wrap-anywhere"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * What gets published.
 *
 * §7 names five things: address, title, description, structured data, links
 * and length. Every one is counted off the body in front of the customer, so
 * the card cannot disagree with the page above it.
 *
 * **The structured-data line names what is told to a search engine rather
 * than showing it.** A reviewer is owed the fact that an article and some
 * number of questions and answers are declared; the JSON-LD itself is the
 * hosted route's and is not a thing a person reads.
 */
export function WhatPublishesCard(p: {
  publisher: Publisher;
  title: string;
  description: string;
  /** Counted from the body by the caller, which already parsed it. */
  counts: { links: number; questions: number; characters: number };
}): React.JSX.Element {
  const rows: readonly {
    key: string;
    label: string;
    value: string;
    value_num: boolean;
  }[] = [
    {
      key: "address",
      label: copy("draft.publishes.address"),
      // **Never a host printed as though it were the page's address.** A
      // page in review has no address: the destination decides the slug at
      // publication and nothing has recorded one, so the row says so rather
      // than showing `example.com` under the word *Address*.
      value: p.publisher.addressRecorded
        ? readableAddress(p.publisher.url)
        : copy("draft.publishes.address.pending", { domain: p.publisher.name }),
      value_num: p.publisher.addressRecorded,
    },
    {
      key: "title",
      label: copy("draft.publishes.title-row"),
      value: p.title,
      value_num: false,
    },
    {
      key: "description",
      label: copy("draft.publishes.description"),
      value: p.description,
      value_num: false,
    },
    {
      key: "schema",
      label: copy("draft.publishes.schema"),
      // "an article, plus 0 questions and answers" is a sentence about
      // nothing: with no question heading in the body there is no FAQ block
      // to declare, so the row names the one thing that is.
      value:
        p.counts.questions === 0
          ? copy("draft.publishes.schema.article")
          : copy("draft.publishes.schema.value", {
              n: String(p.counts.questions),
            }),
      value_num: false,
    },
    {
      key: "links",
      label: copy("draft.publishes.links"),
      value: String(p.counts.links),
      value_num: true,
    },
    {
      key: "length",
      label: copy("draft.publishes.length"),
      value: copy("draft.publishes.length.value", {
        n: String(p.counts.characters),
      }),
      value_num: true,
    },
  ];

  return (
    <section
      className="card card-border bg-base-100 min-w-0"
      data-testid="draft-publishes"
    >
      <div className="card-body min-w-0 gap-3">
        <h2 className={CARD_HEAD}>
          <FileText size={20} strokeWidth={1.75} aria-hidden />
          {copy("draft.publishes.title")}
        </h2>
        {/* `dt`/`dd` are the grid's own children — **no `display: contents`
            wrapper around each pair.** An element with no box of its own
            makes every child read as escaping its parent, which is 12
            containment offenders on this card alone and a real defect the
            first time a value needs to be measured against its column.
            A flat list of cells is what a two-column `dl` is. */}
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rows
            .filter((row) => row.value !== "")
            .flatMap((row) => [
              <dt
                className="min-w-0 text-base-content/70"
                key={`${row.key}-label`}
              >
                {row.label}
              </dt>,
              <dd
                className={
                  row.value_num
                    ? `num num-phrase ${VALUE_BOX}`
                    : "min-w-0 wrap-anywhere"
                }
                data-testid={`draft-publishes-${row.key}`}
                key={`${row.key}-value`}
                // A value gets the box; a sentence (the title, the
                // description) wraps at its spaces and needs none.
                tabIndex={row.value_num ? 0 : undefined}
              >
                {row.value}
              </dd>,
            ])}
        </dl>
      </div>
    </section>
  );
}
