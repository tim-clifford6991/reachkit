// SPEC §5 — the market step of `/setup`: the site address, the market
// category (editable) and the twelve questions read-only. daisyUI classes
// in the route (DESIGN.md rule 1): `card`, `badge`, `btn`, `input`,
// `alert`, `collapse`; lucide glyphs at 1.75.
//
// Which card renders and what a domain change clears are
// `@/lib/market/setup/state`'s pure functions. This file holds the text a
// founder is part-way through typing, and which of the two is open.
"use client";

import type React from "react";
import { useId, useMemo, useState, useTransition, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { Globe, ListOrdered } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { fromStored, renderQuestion } from "@/lib/presentation/generated";
import { rederiveQuestions } from "@/lib/market/questions/rederive";
import {
  onDomainChanged,
  onMarketStated,
  validateAddress,
  type AddressRefusal,
  type SetupState,
} from "@/lib/market/setup/state";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";
import type { SetupQuestions } from "./_setup/facts";

const ADDRESS_REFUSAL_COPY = {
  not_a_domain: "setup.address.refused.not-a-domain",
  does_not_resolve: "setup.address.refused.unreachable",
} as const satisfies Record<AddressRefusal, string>;

const ICON = { strokeWidth: 1.75, size: 20, "aria-hidden": true } as const;
const CARD = "card bg-base-100 shadow-sm";
const ROW = "flex min-w-0 flex-wrap items-center justify-between gap-3";
const QUIET = "text-sm text-base-content/70";
/** A quiet empty (the calm layer, #1059): a flat grey cell and one line —
 *  never a white card or a coloured alert for a thing that is not there. */
const EMPTY = "rounded-box bg-base-200 px-3 py-2 text-sm text-base-content/70";
const CHANGE = "btn btn-sm btn-ghost";
const CHIP = "badge badge-primary badge-soft h-auto py-1 wrap-anywhere";

const SITE_AND_MARKET_TEST_ID = "setup-site-and-market";
const ADDRESS_TEST_ID = "setup-address";
const MARKET_TEST_ID = "setup-market";
const AWAITING_SITE = "site";

export function MarketCard(p: {
  state: SetupState;
  setState: Dispatch<SetStateAction<SetupState>>;
  questions: SetupQuestions | null;
  resolveDomain: (host: string) => Promise<ResolveDomainResponse>;
}): React.JSX.Element {
  const { state, setState } = p;
  const addressId = useId();
  const marketId = useId();
  const [addressDraft, setAddressDraft] = useState(state.siteDomain ?? "");
  const [addressRefusal, setAddressRefusal] = useState<AddressRefusal | null>(null);
  const [editingAddress, setEditingAddress] = useState(state.address.state !== "measured");
  const [marketDraft, setMarketDraft] = useState("");
  const [editingMarket, setEditingMarket] = useState(state.market.state === "empty");

  // Issue 1196: the address check is a request; its button waits on it.
  const [resolving, startResolving] = useTransition();

  function commitAddress(): void {
    if (resolving) return;
    startResolving(commitAddressNow);
  }

  async function commitAddressNow(): Promise<void> {
    const answer = await p.resolveDomain(addressDraft);
    const checked = validateAddress(answer.domain, answer.resolves);
    if (!checked.ok) {
      setAddressRefusal(checked.because);
      return;
    }
    setAddressRefusal(null);
    setEditingAddress(false);
    // REQ-026 c6: the market card then stands by the address they gave.
    setState((current) => onDomainChanged(current, { domain: checked.domain, report: answer.report }));
  }

  function commitMarket(): void {
    const category = marketDraft.trim();
    if (category === "") return;
    setState((current) => onMarketStated(current, category));
    setEditingMarket(false);
  }

  function openMarket(): void {
    setMarketDraft(state.market.state === "empty" ? "" : state.market.category);
    setEditingMarket(true);
  }

  /** Enter commits the one field; it must not submit the whole setup. */
  function onEnter(commit: () => void) {
    return (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit();
    };
  }

  // SPEC §5: the questions are the measured market's, shown while the
  // market card is still that scan's. §12 ruling 4: a category the founder
  // corrects re-derives them over the market that same scan bought — in
  // the browser, buying nothing. An address this scan did not measure has
  // no twelve here at all.
  const stated = state.market.state === "stated" ? state.market.category : null;
  const questions = useMemo((): SetupQuestions["items"] | null => {
    const q = p.questions;
    if (q === null) return null;
    if (state.market.state === "inferred") {
      return state.market.fromScanId === q.scanId ? q.items : null;
    }
    if (stated === null || q.derivable === null) return null;
    if (state.address.state !== "measured" || state.address.fromScanId !== q.scanId) return null;
    const derived = rederiveQuestions({ ...q.derivable, category: stated });
    return derived.length === 0
      ? null
      : derived.map((question, index) => ({
          n: index + 1,
          search: question.search,
          wording: fromStored("questions.wording", question.wording),
        }));
  }, [p.questions, state.market, state.address, stated]);

  const questionList = questions === null ? null : <QuestionList items={questions} />;

  // D28 (#1185): a market ReachKit concluded says why, and that the founder
  // need not change it.
  const reason = state.market.state === "inferred" ? (state.market.reason ?? null) : null;
  const concludedLine =
    reason === null ? null : (
      <div className="flex min-w-0 flex-col gap-1" data-testid="setup-market-concluded">
        {reason === "" ? null : <p className="text-sm wrap-anywhere">{reason}</p>}
        <p className={QUIET}>{copy("setup.market.concluded")}</p>
      </div>
    );

  // REQ-021 c6: a measured address and an inferred market are one card,
  // because both are known and each needs only a Change.
  if (
    state.address.state === "measured" &&
    !editingAddress &&
    state.market.state !== "empty" &&
    !editingMarket
  ) {
    return (
      <section className={CARD} data-testid={SITE_AND_MARKET_TEST_ID}>
        <div className="card-body gap-4">
          <h2 className="card-title text-base">
            <Globe {...ICON} />
            {copy("setup.site-and-market.title")}
          </h2>
          <div className={ROW}>
            <p className="num min-w-0 wrap-anywhere" data-testid="setup-address-value">
              {state.address.domain}
            </p>
            <button type="button" className={CHANGE} onClick={() => setEditingAddress(true)}>
              {copy("setup.address.change")}
            </button>
          </div>
          <div className={ROW} data-testid={MARKET_TEST_ID}>
            <span className={CHIP} data-testid="setup-market-chip">
              {state.market.category}
            </span>
            <button type="button" className={CHANGE} onClick={openMarket}>
              {copy("setup.market.change")}
            </button>
          </div>
          {concludedLine}
          {questionList}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={CARD} data-testid={ADDRESS_TEST_ID}>
        <div className="card-body gap-4">
          <h2 className="card-title text-base">
            <Globe {...ICON} />
            {copy("setup.address.title")}
          </h2>
          {state.address.state === "measured" && !editingAddress ? (
            <>
              <p className="num wrap-anywhere" data-testid="setup-address-value">
                {state.address.domain}
              </p>
              <p className={QUIET} data-testid="setup-address-measured">
                {copy("setup.address.measured")}
              </p>
              <div>
                <button type="button" className={CHANGE} onClick={() => setEditingAddress(true)}>
                  {copy("setup.address.change")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={QUIET} htmlFor={addressId}>
                  {copy("setup.address.label")}
                </label>
                <div className="flex gap-2">
                  <input
                    id={addressId}
                    type="text"
                    name="domain"
                    className={`input num w-full ${addressRefusal === null ? "" : "input-error"}`}
                    placeholder={copy("setup.address.placeholder")}
                    value={addressDraft}
                    aria-invalid={addressRefusal !== null}
                    onChange={(event) => {
                      setAddressDraft(event.target.value);
                      setAddressRefusal(null);
                    }}
                    onKeyDown={onEnter(commitAddress)}
                  />
                  <button
                    type="button"
                    className="btn btn-soft btn-primary"
                    disabled={resolving}
                    onClick={commitAddress}
                  >
                    {resolving ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                    {copy("setup.address.change")}
                  </button>
                </div>
              </div>
              {addressRefusal === null ? null : (
                <div role="alert" className="alert alert-error alert-soft text-sm">
                  {copy(ADDRESS_REFUSAL_COPY[addressRefusal])}
                </div>
              )}
              {/* REQ-021 c7: the address they paid with is not assumed to
                  be the site, said where the field is. */}
              <p className={QUIET} data-testid="setup-address-assurance">
                {copy("setup.address.assurance")}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Before the site is given, one line says when a suggestion arrives
          rather than an empty field for something not sought yet. Once it
          is given — measured or typed — the market can be stated. */}
      <section
        className={CARD}
        data-testid={MARKET_TEST_ID}
        data-awaiting={state.siteDomain === null ? AWAITING_SITE : undefined}
      >
        <div className="card-body gap-4">
          <h2 className="card-title text-base">
            <Globe {...ICON} />
            {copy("setup.market.title")}
          </h2>
          {state.siteDomain === null ? (
            <p className={EMPTY} data-testid="setup-market-awaiting-site">
              {copy("setup.market.awaiting-site")}
            </p>
          ) : state.market.state === "empty" || editingMarket ? (
            <>
              {state.market.state === "empty" ? (
                <p data-testid="setup-market-state-it">{copy("setup.market.state-it")}</p>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label className={QUIET} htmlFor={marketId}>
                  {copy("setup.market.label")}
                </label>
                <div className="flex gap-2">
                  <input
                    id={marketId}
                    type="text"
                    name="category"
                    className="input w-full"
                    placeholder={copy("setup.market.placeholder")}
                    value={marketDraft}
                    onChange={(event) => setMarketDraft(event.target.value)}
                    onKeyDown={onEnter(commitMarket)}
                  />
                  <button type="button" className="btn btn-soft btn-primary" onClick={commitMarket}>
                    {copy("setup.market.change")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={ROW}>
              <span className={CHIP} data-testid="setup-market-chip">
                {state.market.category}
              </span>
              <button type="button" className={CHANGE} onClick={openMarket}>
                {copy("setup.market.change")}
              </button>
            </div>
          )}
          {editingMarket ? null : concludedLine}
          {questionList}
        </div>
      </section>
    </>
  );
}

/** SPEC §5: the twelve, read-only. Each wording reaches the screen only
 *  beside the search it was phrased from (REQ-093 c3). */
function QuestionList(p: { items: SetupQuestions["items"] }): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow bg-base-200" data-testid="setup-market-questions">
      <summary className="collapse-title flex items-center gap-2 text-sm font-medium">
        <ListOrdered {...ICON} size={16} />
        {/* Issue 873: the real count, here as on the report — this list is
            as long as the pass's own questions, never twelve by assertion. */}
        {copy("ai-answers.questions.title", { total: String(p.items.length) })}
      </summary>
      <ol className="collapse-content grid gap-3">
        {p.items.map((question) => {
          const [wording, provenance] = renderQuestion({
            wording: question.wording,
            provenance: question.search,
          });
          return (
            // `min-w-0`: this row is a **grid item** of the `<ol>` above, and
            // a grid item's `min-width` is `auto`, so it refuses to shrink
            // below its content however hard the column squeezes. At 320px
            // that pushed the row ten pixels past the screen — and the
            // document does not scroll sideways, so those ten pixels were
            // cut off rather than reachable (WCAG 1.4.10 Reflow, #328). The
            // band the gate sweeps starts at 390, which is why nothing saw
            // it.
            <li key={question.n} className="flex min-w-0 gap-3">
              <span className="num text-sm text-base-content/70">{question.n}</span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm">{wording.text}</span>
                <span className="num text-xs text-base-content/70 wrap-anywhere">{provenance.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
