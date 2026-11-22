// SPEC §7 (2026-09-20, #908) · issue #931 — what a page's tabs hold beside the article: the checks, the search
// result, what it adds and its links. Each states a fact the screen already holds and is absent with nothing to say.
//
// **Nothing here is a scroller.** A passage is prose and folds; an address is
// a value and carries `.num`, so where it will not fit the box grows taller
// (`src/ui/type.css` states that rule and why).
import type React from "react";
import { Check, LoaderCircle, Minus, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { CheckList, CheckRow, CheckStatus } from "./checks";
import { pageLinksEmpty, type LinkGroup, type LinkLive, type PageLink, type PageLinks } from "./links-panel";
import { targetReadings } from "../../calendar/target-readings";
import type { DraftTarget, PageAdds, Publisher } from "./model";

/** The card the live screen's figures and the loading state stand in. */
export const NOTE = Object.freeze({
  card: "card card-border bg-base-100 min-w-0",
  inner: "flex min-w-0 flex-col gap-3",
});

/**
 * An address as a reader reads it: the host and the path, with the scheme
 * dropped — the same spelling a search result's own address line uses and
 * the same one the page frame's bar draws.
 *
 * **The host is kept.** It was the path alone for a while, which read as
 * `/pricing/crm` and so said nothing about whose page it was.
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

/**
 * How the page appears in a search result.
 *
 * The three things a result is made of and nothing else: the address, the
 * title, the description. Drawn in a result's own order — address above,
 * title as the link, description under it — so the customer reads the thing
 * a searcher will read rather than three form fields.
 *
 * **A tab of its own**, on a quiet ground the way a result sits on a
 * results page. The description is drawn whole
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
    <section className="flex min-w-0 flex-col gap-2" data-testid="draft-search-result">
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
    </section>
  );
}

const FIT_COPY = Object.freeze({ answer: "draft.why.fit.answer", helps: "draft.why.fit.helps" } as const);

/** The search the page is for: its fit, how often it is searched and who answers it today, each stored on the
 *  opportunity when the page was chosen; nothing is re-measured. */
export function SearchFacts(p: { target: Extract<DraftTarget, { kind: "target" }> }): React.JSX.Element {
  const facts = p.target.target;
  const { volume } = targetReadings(facts);
  const fit = p.target.why?.fit ?? null;
  const rival = p.target.why?.rival ?? null;
  return (
    <section className={NOTE.inner} data-testid="draft-search">
      {fit === null ? null : <p className="text-sm">{copy(FIT_COPY[fit])}</p>}
      <dl className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-base-content/70">{copy("draft.search.query")}</dt>
        <dd className="num min-w-0 wrap-anywhere">{facts.search}</dd>
        <dt className="text-base-content/70">{copy("draft.search.volume")}</dt>
        <dd className="min-w-0 wrap-anywhere">{volume.isDash ? (volume.line ?? volume.text) : volume.text}</dd>
        {rival === null ? null : (
          <>
            <dt className="text-base-content/70">{copy("draft.search.rival")}</dt>
            <dd className="num min-w-0 wrap-anywhere">{rival}</dd>
          </>
        )}
      </dl>
    </section>
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
    <section className="min-w-0" data-testid="draft-adds">
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
    <section className="min-w-0" data-testid="draft-links">
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
  return (
    <section className="min-w-0" data-testid="draft-checks">
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
    </section>
  );
}
