// SPEC §7 (2026-09-20, #908) · issue #931 — the three cards beside the page.
// Since 2026-10-07 (issue 1325) each is a note: one closed line under the
// article, opened in place.
//
// "…with beside it: why this page; **how it appears in search results**;
// ***written from your business*** — each fact, quote and promise used and
// where it was read; **what gets published** (address, title, description,
// structured data, links, length); the checks."
//
// *Why this page* is `TargetBlock`'s. The notes here are board `AppDraft`'s,
// in its order: the checks, the search result, what the page stands on, what
// it adds and its links.
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
import { Check, Link, LoaderCircle, Minus, Quote, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { CLOSED } from "../../_overview/present";
import type { CheckList, CheckRow, CheckStatus } from "./checks";
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
              <span className="min-w-0 font-mono break-all text-xs text-base-content/70">
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
            <p className="text-xs text-base-content/70">{copy("draft.search-result.caption")}</p>
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
  const claims = pack?.claims ?? [];

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
              {/* The note opens with its counts (issue 1395): the facts read
                  on the site, and the public pages the market's were read
                  from. Both are counted off this page's own record. */}
              <p className="text-sm font-medium wrap-anywhere" data-testid="written-from-counts">
                {copy("draft.written-from.counts", { site: facts.length, market: marketSources(claims) })}
              </p>
              <p className="text-sm text-base-content/70 wrap-anywhere">
                {copy("draft.written-from.lead")}
              </p>

              {facts.length === 0 ? null : <h3 className="eyebrow">{copy("draft.written-from.site")}</h3>}
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
                          <span className="min-w-0 max-w-full">
                            <a
                              className="link link-hover font-mono break-all text-xs"
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

        {claims.length === 0 ? null : <MarketFacts claims={claims} timeZone={p.timeZone} />}

        {pack === undefined ? null : <PackFold pack={pack} />}
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

/** How many different public pages the market facts were read from — the
 *  count the note opens with (issue 1395). */
export function marketSources(claims: PackView["claims"]): number {
  return new Set(claims.map((claim) => claim.url)).size;
}

/**
 * From market research (SPEC §4, 2026-10-10; issue 1395): what the page says
 * about the market, each passage with the public page it was read off and
 * how long ago. It stood inside the fold below until the two sources were
 * listed apart.
 */
function MarketFacts(p: { claims: PackView["claims"]; timeZone: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-base-300 pt-3" data-testid="written-from-market">
      <h3 className="eyebrow">{copy("draft.written-from.market")}</h3>
      <ul className={`${PACK_LIST} text-sm`}>
        {p.claims.map((claim, at) => {
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
  );
}
const PACK_LIST = "flex min-w-0 list-none flex-col gap-2 p-0";

/**
 * The whole context pack, folded (SPEC §7, 2026-10-04, D41: "one JSON
 * object stored with the draft and readable on the draft screen under
 * *written from your business*"; issue 1252).
 *
 * One daisyUI `collapse` on a `details`, closed until it is asked for: the
 * card above it is what most reviews need, and the pack is the long form
 * for the founder who wants to see everything the writer was handed. It
 * holds what the lists above do not — the question, the site's own pages,
 * the never-claim list and what was missing — and repeats neither the
 * business facts nor the market's (issue 1395 lists those above it).
 *
 * Text only, and every line folds: a passage and a title are prose, so
 * nothing in here is a value box or a scroller.
 */
function PackFold(p: { pack: PackView }): React.JSX.Element {
  const { question, pages, pagesMore, neverClaim, missing } = p.pack;
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
 * about the business, is set aside and the day takes the next topic; the
 * one line under the list says so and asks for nothing (issue 1393).
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
        {/* Open where the page was set aside: that sentence is why there is
            no page, and it must not be hidden (SPEC §7, 2026-10-07). */}
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
                <p className="min-w-0 border-t border-base-300 pt-3 text-sm wrap-anywhere" data-testid="draft-adds-ask">
                  {copy("draft.adds.ask")}
                </p>
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
              <Link size={14} strokeWidth={1.75} aria-hidden />
              {copy("draft.links.title")}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={NOTE.inner}>
              <p className="text-sm text-base-content/70 wrap-anywhere">{copy("draft.links.lead")}</p>

              {LINK_GROUPS.map(({ group, title }) =>
                p.links[group].length === 0 ? null : (
                  <div className="flex min-w-0 flex-col gap-1" key={group} data-testid={`draft-links-${group}`}>
                    <h3 className="eyebrow">{copy(title)}</h3>
                    <ul className="list bg-base-100 min-w-0 rounded-box">
                      {p.links[group].map((link) => (
                        <li className="list-row min-w-0" key={link.url}>
                          <span className="list-col-grow min-w-0 text-sm wrap-anywhere">{link.text}</span>
                          <span className="list-col-wrap flex min-w-0 flex-col items-start gap-1">
                            <span className="min-w-0 max-w-full">
                              <a className="link link-hover font-mono break-all text-xs" href={link.url} target="_blank" rel="noreferrer">
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
                  <h3 className="eyebrow">{copy("draft.links.removed")}</h3>
                  <ul className="list bg-base-100 min-w-0 rounded-box">
                    {p.links.removed.map((link) => (
                      <li className="list-row min-w-0" key={`${link.url}-${link.text}`}>
                        <span className="list-col-grow min-w-0 text-sm wrap-anywhere">{link.text}</span>
                        <span className="list-col-wrap flex min-w-0 flex-col items-start gap-1">
                          <span className="min-w-0 max-w-full font-mono break-all text-xs text-base-content/70">
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

/** A row's mark: a ring and a glyph. Green for a pass; the quiet ink for a
 *  rule the page was not asked, one it failed and the one still running. */
const RING = "grid size-5 shrink-0 place-items-center rounded-full";
const QUIET = `${RING} bg-base-200 text-base-content/70`;
const MARK: Readonly<Record<CheckStatus, { ring: string; Icon: typeof Check }>> = {
  passed: { ring: `${RING} bg-success/15 text-success`, Icon: Check },
  skipped: { ring: QUIET, Icon: Minus },
  failed: { ring: QUIET, Icon: X },
  pending: { ring: QUIET, Icon: LoaderCircle },
};

/** What a row that is not a pass says under its sentence. */
function statusLine(status: CheckStatus): string | null {
  if (status === "skipped") return copy("draft.checks.status.skipped");
  if (status === "failed") return copy("draft.checks.status.failed");
  return status === "pending" ? copy("draft.claim.outstanding") : null;
}

function CheckItem(p: { row: CheckRow }): React.JSX.Element {
  const { ring, Icon } = MARK[p.row.status];
  const status = statusLine(p.row.status);
  return (
    <li className="flex items-start gap-2.5" data-testid={`draft-check-${p.row.rule}`} data-status={p.row.status}>
      <span className={ring} aria-hidden>
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={p.row.status === "passed" ? undefined : "text-base-content/70"}>{copy(p.row.key, p.row.vars)}</span>
        {status === null ? null : <span className="text-xs text-base-content/70">{status}</span>}
      </span>
    </li>
  );
}

/** What the reader is owed first: a rule that did not pass, then the passes. */
const FIRST: Readonly<Record<CheckStatus, number>> = { failed: 0, pending: 1, passed: 2, skipped: 3 };

/** How many rows the closed card names before "and {n} more". */
export const CHECKS_SHOWN = 5;

/**
 * The checks (SPEC §7; board `AppDraft`): the count in the card's one closed
 * line, then the first rows and the rest one level further down, and how the
 * battery decides. The count is the battery's own (E10).
 */
export function ChecksCard(p: { list: CheckList }): React.JSX.Element | null {
  const { rows, counts } = p.list;
  if (rows.length === 0) return null;
  const ordered = [...rows].sort((a, b) => FIRST[a.status] - FIRST[b.status]);
  const shown = ordered.slice(0, CHECKS_SHOWN);
  const rest = ordered.slice(CHECKS_SHOWN);
  const allPassed = counts !== null && counts.failed === 0 && !rows.some((row) => row.status === "pending");
  return (
    <section className={NOTE.card} data-testid="draft-checks">
      <div className={NOTE.pad}>
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className={CARD_HEAD}>
              <ShieldCheck size={14} strokeWidth={1.75} aria-hidden />
              <span data-testid="draft-checks-headline">
                {counts === null
                  ? copy("draft.checks.title")
                  : copy("draft.checks.headline", { passed: counts.passed, total: counts.total })}
              </span>
              {allPassed ? <span className="badge badge-soft badge-success badge-sm">{copy("draft.checks.all-passed")}</span> : null}
            </h2>
          </summary>
          <div className={CLOSED.body}>
            <div className={`${NOTE.inner} text-sm`}>
              <ul className="flex flex-col gap-2.5">
                {shown.map((row) => (
                  <CheckItem row={row} key={row.rule} />
                ))}
              </ul>
              {rest.length === 0 ? null : (
                <details className="collapse collapse-arrow min-w-0 rounded-none" data-testid="draft-checks-more">
                  <summary className="collapse-title min-h-0 p-0 pe-10 text-base-content/70">
                    {copy("draft.checks.more", { n: String(rest.length) })}
                  </summary>
                  <ul className="collapse-content flex flex-col gap-2.5 px-0 pt-2">
                    {rest.map((row) => (
                      <CheckItem row={row} key={row.rule} />
                    ))}
                  </ul>
                </details>
              )}
              {counts === null || counts.fixed === 0 ? null : (
                <p className="text-xs text-base-content/70" data-testid="draft-checks-fixed">
                  {copy("draft.checks.count.fixed", { n: counts.fixed })}
                </p>
              )}
              <p className="text-base-content/70">{copy("draft.checks.decided")}</p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
