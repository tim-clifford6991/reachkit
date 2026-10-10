// SPEC §7 (2026-09-20, #908) · issue #931 — the three cards beside the page.
// Since 2026-10-07 (issue 1325) each is a note: one closed line under the
// article, opened in place.
//
// "…with beside it: why this page; **how it appears in search results**;
// ***written from your business*** — each fact, quote and promise used and
// where it was read; **what gets published** (address, title, description,
// structured data, links, length); the checks."
//
// *Why this page* is `TargetBlock`'s and the checks are `DecidePanel`'s, both
// already on this screen. The three here are the ones §7 names that nothing
// drew: what a search result looks like (drawn inside `TargetBlock`'s card
// since #1072), what the page stands on, and what actually leaves the
// building.
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
import { FileText, Link2, Quote, Search, Sparkles } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { CLOSED } from "../../_overview/present";
import { pageLinksEmpty, type LinkGroup, type LinkLive, type PageLink, type PageLinks } from "./links-panel";
import {
  PACK_NEED_COPY,
  writtenFromIsEmpty,
  type PackView,
  type PageAdds,
  type Publisher,
  type WrittenFrom,
} from "./model";

/** The eyebrow every card on this screen heads itself with. Matches the
 *  rows already on it rather than minting a second heading style. */
const CARD_HEAD = "eyebrow flex items-center gap-2";

/**
 * A note under the page (SPEC §7, 2026-10-07, issue 1325): a card that is
 * one closed line, named by its own title, and opens in place. The
 * `details` and its `summary` take `CLOSED`'s classes, the ones Search, AI
 * answers and Rivals close a sentence with (`docs/DESIGN.md`, *Closed
 * sentences*); these three are the card around them and the column inside.
 */
export const NOTE = Object.freeze({
  card: "card card-border bg-base-100 min-w-0",
  pad: "min-w-0 p-4",
  inner: "flex min-w-0 flex-col gap-3",
});

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

/** Between a public page's name and the day it was read. */
const PACK_SEPARATOR = " · ";

/**
 * How the page appears in a search result.
 *
 * The three things a result is made of and nothing else: the address, the
 * title, the description. Drawn in a result's own order — address above,
 * title as the link, description under it — so the customer reads the thing
 * a searcher will read rather than three form fields.
 *
 * **A note of its own** (issue 1325; it was half of `TargetBlock`'s card,
 * #1072): one closed line under *What this page is for*, on a quiet ground
 * the way a result sits on a results page. The description is drawn whole
 * rather than clamped to two lines as the board draws it: the layout
 * sweep's check 5 does not admit a clamp on this card.
 *
 * **It is a rendering of their own text, not a judgement of it.** No length
 * warning, no score, no "too long": the editor is where a length count
 * belongs (SPEC §7's editor line), and a verdict here would be this
 * product's opinion dressed as a preview.
 */
export function SearchResult(p: {
  title: string;
  description: string;
  publisher: Publisher;
}): React.JSX.Element {
  return (
    <section className={NOTE.card} data-testid="draft-search-result">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <Search size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.search-result.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-4">
              <span
                className={`num text-xs text-base-content/70 ${VALUE_BOX}`}
                tabIndex={0}
              >
                {readableAddress(p.publisher.url)}
              </span>
              {/* The title as a result draws it: the one blue line. Not a link —
                  there is nowhere to send a reviewer, and a dead link in a
                  preview reads as a broken page. */}
              <span
                className="text-primary text-lg font-medium wrap-anywhere"
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
        </details>
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
  /** The site's zone, for the day each public page was read. */
  timeZone: string;
}): React.JSX.Element | null {
  if (writtenFromIsEmpty(p.writtenFrom)) return null;
  const { facts, profileItems, pack } = p.writtenFrom;

  return (
    <section className={NOTE.card} data-testid="draft-written-from">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <Quote size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.written-from.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={NOTE.inner}>
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
                      {/* One second row: the source, then the fact's age (D59, issue
                          1287). One `list-col-wrap`, so the grid keeps its one
                          column. */}
                      <span className="list-col-wrap flex min-w-0 flex-col gap-1">
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
                          <span className="min-w-0 text-xs text-base-content/70 wrap-anywhere">
                            {copy("draft.written-from.source-unknown")}
                          </span>
                        ) : (
                          <span className={VALUE_BOX}>
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
                        {fact.ageDays === undefined ? null : (
                          <span className="min-w-0 text-xs text-base-content/70" data-testid="written-from-fact-age">
                            {ageLine(fact.ageDays)}
                          </span>
                        )}
                      </span>
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

        {pack === undefined ? null : <PackFold pack={pack} timeZone={p.timeZone} />}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

/** A fact's age as the card says it (SPEC §7, D59; issue 1287). */
function ageLine(ageDays: number): string {
  if (ageDays === 0) return copy("draft.written-from.age.today");
  if (ageDays === 1) return copy("draft.written-from.age.one");
  return copy("draft.written-from.age.days", { days: String(ageDays) });
}

/** A public page as a link names it: its title, or its host where the read
 *  kept none. */
function pageName(claim: { url: string; title: string }): string {
  if (claim.title.trim() !== "") return claim.title;
  try {
    return new URL(claim.url).host;
  } catch {
    return claim.url;
  }
}

/** The day a page was read, or `null` where the pack kept no date a
 *  calendar can read. */
function readDay(readAt: string, timeZone: string): string | null {
  const at = new Date(readAt);
  return Number.isNaN(at.getTime()) ? null : formatDate(at, timeZone);
}

const PACK_GROUP = "flex min-w-0 flex-col gap-1";
const PACK_LIST = "flex min-w-0 list-none flex-col gap-2 p-0";

/**
 * The whole context pack, folded (SPEC §7, 2026-10-04, D41: "one JSON
 * object stored with the draft and readable on the draft screen under
 * *written from your business*"; issue 1252).
 *
 * One daisyUI `collapse` on a `details`, closed until it is asked for: the
 * card above it is what most reviews need, and the pack is the long form
 * for the founder who wants to see everything the writer was handed. It
 * holds what the lists above do not — the question, the public pages'
 * claims, the site's own pages, the never-claim list and what was missing —
 * and repeats none of the business facts.
 *
 * Text only, and every line folds: a passage and a title are prose, so
 * nothing in here is a value box or a scroller.
 */
function PackFold(p: { pack: PackView; timeZone: string }): React.JSX.Element {
  const { question, claims, pages, pagesMore, neverClaim, missing } = p.pack;
  return (
    <details
      className="collapse collapse-arrow border-base-300 min-w-0 border"
      data-testid="written-from-pack"
    >
      <summary className="collapse-title min-w-0 text-sm font-medium wrap-anywhere">
        {copy("draft.written-from.pack.title")}
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-4 text-sm">
        {question === "" ? null : (
          <div className={PACK_GROUP}>
            <h3 className="eyebrow">{copy("draft.written-from.pack.question")}</h3>
            <p className="min-w-0 wrap-anywhere">{question}</p>
          </div>
        )}

        {claims.length === 0 ? null : (
          <div className={PACK_GROUP} data-testid="written-from-pack-claims">
            <h3 className="eyebrow">{copy("draft.written-from.pack.claims")}</h3>
            <ul className={PACK_LIST}>
              {claims.map((claim, at) => {
                const day = readDay(claim.readAt, p.timeZone);
                return (
                  <li className="flex min-w-0 flex-col" key={`${String(at)}-${claim.url}`}>
                    <span className="min-w-0 wrap-anywhere">{claim.passage}</span>
                    <span className="min-w-0 text-xs text-base-content/70 wrap-anywhere">
                      <a className="link link-hover" href={claim.url} target="_blank" rel="noreferrer">
                        {pageName(claim)}
                      </a>
                      {claim.ageDays !== undefined ? (
                        <>
                          {PACK_SEPARATOR}
                          {ageLine(claim.ageDays)}
                        </>
                      ) : day === null ? null : (
                        <>
                          {PACK_SEPARATOR}
                          {copy("draft.written-from.pack.claims.read", { at: day })}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {pages.length === 0 ? null : (
          <div className={PACK_GROUP} data-testid="written-from-pack-pages">
            <h3 className="eyebrow">{copy("draft.written-from.pack.pages")}</h3>
            <ul className={PACK_LIST}>
              {pages.map((page, at) => (
                <li className="min-w-0 wrap-anywhere" key={`${String(at)}-${page}`}>
                  {page}
                </li>
              ))}
            </ul>
            {pagesMore === 0 ? null : (
              <p className="min-w-0 text-xs text-base-content/70">
                {copy("draft.written-from.pack.pages.more", { n: String(pagesMore) })}
              </p>
            )}
          </div>
        )}

        {neverClaim.length === 0 ? null : (
          <div className={PACK_GROUP} data-testid="written-from-pack-never">
            <h3 className="eyebrow">{copy("draft.written-from.pack.never-claim")}</h3>
            <ul className={PACK_LIST}>
              {neverClaim.map((entry) => (
                <li className="min-w-0 wrap-anywhere" key={entry}>
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        )}

        {missing.length === 0 ? null : (
          <div className={PACK_GROUP} data-testid="written-from-pack-missing">
            <h3 className="eyebrow">{copy("draft.written-from.pack.missing")}</h3>
            <ul className={PACK_LIST}>
              {missing.map((need) => (
                <li className="min-w-0 wrap-anywhere" key={need}>
                  {copy(PACK_NEED_COPY[need])}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * What this page adds (SPEC §7, 2026-09-29, D12; issue 1143).
 *
 * The sentences of the page that say something neither the top results for
 * its search nor the customer's own pages say — each one a sentence the
 * reader can find on the page beside it, with a mark on the ones that are
 * facts about the business. A new page with fewer than three, or with none
 * about the business, is held; the one line under the list then asks the
 * founder for the fact that is missing and says where to give it.
 *
 * **Absent on a page written before the list was made**, like the card
 * above it: no list is not a page that adds nothing.
 */
export function WhatAddsCard(p: { adds: PageAdds | undefined }): React.JSX.Element | null {
  if (p.adds === undefined) return null;
  const { claims, ask } = p.adds;

  return (
    <section className={NOTE.card} data-testid="draft-adds">
      <div className={NOTE.pad}>
        {/* Open where it asks for a fact: that sentence is what the founder
            has to do, and a held page must not hide it (SPEC §7,
            2026-10-07). */}
        <details className={CLOSED.root} open={ask}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <Sparkles size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.adds.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={NOTE.inner}>
              <p className="text-sm text-base-content/70 wrap-anywhere">
                {copy(claims.length === 0 ? "draft.adds.none" : "draft.adds.lead")}
              </p>

              {claims.length === 0 ? null : (
                <ul className="list bg-base-100 min-w-0 rounded-box" data-testid="draft-adds-claims">
                  {claims.map((each) => (
                    <li className="list-row min-w-0" key={each.claim}>
                      <span className="list-col-grow min-w-0 text-sm wrap-anywhere">{each.claim}</span>
                      {each.business ? (
                        <span className="list-col-wrap min-w-0">
                          <span className="badge badge-ghost h-auto max-w-full py-1 whitespace-normal wrap-anywhere">
                            {copy("draft.adds.business")}
                          </span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {ask ? (
                <div
                  className="flex min-w-0 flex-col items-start gap-1 border-t border-base-300 pt-3 text-sm"
                  data-testid="draft-adds-ask"
                >
                  <p className="min-w-0 wrap-anywhere">{copy("draft.adds.ask")}</p>
                  <a className="link" href="/app/settings">
                    {copy("draft.adds.ask.action")}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

const LINK_GROUPS: readonly { group: LinkGroup; title: "draft.links.site" | "draft.links.articles" | "draft.links.sources" }[] = [
  { group: "site", title: "draft.links.site" },
  { group: "articles", title: "draft.links.articles" },
  { group: "sources", title: "draft.links.sources" },
];

const LINK_LIVE: Readonly<Record<LinkLive, { key: "draft.links.live" | "draft.links.unchecked" | "draft.links.pending"; badge: string }>> = {
  live: { key: "draft.links.live", badge: "badge badge-success" },
  unchecked: { key: "draft.links.unchecked", badge: "badge badge-ghost" },
  pending: { key: "draft.links.pending", badge: "badge badge-ghost" },
};

function linkReason(link: PageLink): string {
  return link.reason.kind === "topic"
    ? copy("draft.links.why.topic", { words: link.reason.words })
    : copy(`draft.links.why.${link.reason.kind}`);
}

/**
 * Links on this page (SPEC §7, 2026-10-10, issue 1391).
 *
 * Every link the body carries, grouped as the customer thinks of them —
 * their site, their articles, the sources — each with its words, where it
 * leads, why it is there and whether it is live. Read off the body in front
 * of them, so an edit that adds or removes a link changes the list.
 *
 * **Absent on a page with no link and nothing removed**, like the cards
 * above it.
 */
export function LinksCard(p: { links: PageLinks }): React.JSX.Element | null {
  if (pageLinksEmpty(p.links)) return null;

  return (
    <section className={NOTE.card} data-testid="draft-links">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <Link2 size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.links.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={NOTE.inner}>
              <p className="text-sm text-base-content/70 wrap-anywhere">{copy("draft.links.lead")}</p>

              {LINK_GROUPS.map(({ group, title }) =>
                p.links[group].length === 0 ? null : (
                  <div className="flex min-w-0 flex-col gap-1" key={group} data-testid={`draft-links-${group}`}>
                    <h3 className="text-sm font-medium">{copy(title)}</h3>
                    <ul className="list bg-base-100 min-w-0 rounded-box">
                      {p.links[group].map((link) => (
                        <li className="list-row min-w-0" key={link.url}>
                          <span className="list-col-grow min-w-0 text-sm wrap-anywhere">{link.text}</span>
                          <span className="list-col-wrap flex min-w-0 flex-col items-start gap-1">
                            <span className={VALUE_BOX}>
                              <a className="link link-hover num text-xs" href={link.url} target="_blank" rel="noreferrer">
                                {readableAddress(link.url)}
                              </a>
                            </span>
                            <span className="min-w-0 text-xs text-base-content/70 wrap-anywhere">{linkReason(link)}</span>
                            <span className={`${LINK_LIVE[link.live].badge} h-auto max-w-full py-1 whitespace-normal wrap-anywhere`}>
                              {copy(LINK_LIVE[link.live].key)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}

              {p.links.removed.length === 0 ? null : (
                <div className="flex min-w-0 flex-col gap-1" data-testid="draft-links-removed">
                  <h3 className="text-sm font-medium">{copy("draft.links.removed")}</h3>
                  <ul className="list bg-base-100 min-w-0 rounded-box">
                    {p.links.removed.map((link) => (
                      <li className="list-row min-w-0" key={`${link.url}-${link.text}`}>
                        <span className="list-col-grow min-w-0 text-sm wrap-anywhere">{link.text}</span>
                        <span className="list-col-wrap flex min-w-0 flex-col items-start gap-1">
                          <span className={`num text-xs text-base-content/70 ${VALUE_BOX}`} tabIndex={0}>
                            {readableAddress(link.url)}
                          </span>
                          <span className="min-w-0 text-xs text-base-content/70 wrap-anywhere">
                            {copy(link.kind === "source" ? "draft.links.removed.source" : "draft.links.removed.site")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </details>
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
    <section className={NOTE.card} data-testid="draft-publishes">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <FileText size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.publishes.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
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
        </details>
      </div>
    </section>
  );
}
