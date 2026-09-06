// BUILD §4.3 — the three decisions and the one submit, as one form.
//
// "Three cards, one submit … No other configuration exists at setup."
// (§4.3) Everything the founder can touch on this screen is here, so
// "exactly three decisions plus the address, and nothing else" is a
// property of one file rather than a review of several.
//
// **Nothing here tunes the engine** (REQ-025 c3): no question count, no
// cadence, no spend cap, no scan depth, no model choice, and no field that
// could carry one — `SetupSubmission` has no member for any of them, and
// `tests/app/setup/screen.test.tsx` walks the rendered tree for a control
// whose name matches that set.
//
// **The state machine is not re-implemented here.** Which market card
// renders, what a domain change clears, what a rival refusal is called and
// what blocks the submit are all `@/lib/market/setup/*`'s, decided by pure
// functions this component calls. This file holds the draft text a founder
// is mid-way through typing and nothing else that could be called a rule.
//
// **One network round-trip decides a domain.** Two of the three facts a
// typed domain needs cannot be had in a browser: whether it resolves in
// DNS (REQ-021 c9, REQ-026 c8) is a network answer, and its canonical
// eTLD+1 comes from a parser that imports `node:net` and therefore cannot
// be bundled for a client at all. `POST /api/setup/domain` answers both,
// and — for the address — answers with them whether a completed report
// exists for the new domain, which is what REQ-026 c6 needs to re-derive
// the market card. Everything downstream of that one call is the pure
// state machine's, which takes the canonical form and never parses.
//
// Suggested rivals make no such call: they came from the product's own
// derivation over the founder's market, so they are already canonical and
// already known to exist.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Badge } from "@/ui/components/Badge";
import { Input } from "@/ui/components/Input";
import { Divider } from "@/ui/components/Divider";
import { copy } from "@/lib/presentation/copy";
import {
  onDomainChanged,
  onMarketStated,
  settledCategory,
  validateAddress,
  validateSetup,
  type AddressRefusal,
  type SetupState,
} from "@/lib/market/setup/state";
import { addRival, isFull, removeRival, type RivalRefusal } from "@/lib/market/setup/rivals";
import {
  preselected,
  type DestinationKind,
  type DnsPending,
  type DnsRecord,
  type PublishingMode,
} from "@/lib/publish/setup/cards";
import type { SetupScreenModel } from "./_setup/facts";
import type { SetupRefusal, SetupSubmission } from "./submit";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";
import type { SetupResult } from "./submit";

const ADDRESS_REFUSAL_COPY = {
  not_a_domain: "setup.address.refused.not-a-domain",
  does_not_resolve: "setup.address.refused.unreachable",
} as const satisfies Record<AddressRefusal, string>;

const RIVAL_REFUSAL_COPY = {
  not_a_domain: "setup.competitors.refused.not-a-domain",
  does_not_resolve: "setup.competitors.refused.does-not-resolve",
  own_domain: "setup.competitors.refused.own-domain",
  already_present: "setup.competitors.refused.already-present",
  set_full: "setup.competitors.refused.set-full",
} as const satisfies Record<RivalRefusal, string>;

/** Every refusal the founder can be shown, as a written line. `SetupResult`'s
 *  `already_complete` is absent on purpose: a founder who has completed setup
 *  is *taken onward* (REQ-025 c4), never shown a refusal, so that arm
 *  navigates rather than rendering. */
const SUBMIT_REFUSAL_COPY = {
  address_missing: "setup.address.missing",
  market_missing: "setup.market.missing",
  invalid_domain: "setup.address.refused.unreachable",
  no_active_access: "setup.refused.no-access",
  too_many_competitors: "setup.competitors.refused.set-full",
} as const satisfies Record<
  Exclude<SetupRefusal, "already_complete"> | "address_missing" | "market_missing",
  string
>;

/** Where the one submit leads (§4.3). An internal route name, not a
 *  customer-visible string. */
const WAITING_PATH = "/setup/waiting";

async function resolveDomain(host: string): Promise<ResolveDomainResponse> {
  const response = await fetch("/api/setup/domain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ host }),
  });
  return (await response.json()) as ResolveDomainResponse;
}

export function SetupForm(p: { model: SetupScreenModel }): React.JSX.Element {
  const router = useRouter();
  const defaults = preselected(p.model.cards);

  const [state, setState] = useState<SetupState>(p.model.state);
  const [addressDraft, setAddressDraft] = useState(p.model.state.siteDomain ?? "");
  const [addressRefusal, setAddressRefusal] = useState<AddressRefusal | null>(null);
  const [editingAddress, setEditingAddress] = useState(p.model.state.address.state !== "measured");
  const [marketDraft, setMarketDraft] = useState("");
  const [editingMarket, setEditingMarket] = useState(p.model.state.market.state === "empty");
  const [rivalDraft, setRivalDraft] = useState("");
  const [rivalRefusal, setRivalRefusal] = useState<RivalRefusal | null>(null);
  const [mode, setMode] = useState<PublishingMode>(defaults.mode);
  const [destination, setDestination] = useState<DestinationKind>(defaults.destination);
  const [submitRefusal, setSubmitRefusal] = useState<keyof typeof SUBMIT_REFUSAL_COPY | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = new Set(state.rivals.map((rival) => rival.domain));
  const full = isFull(state.rivals);

  async function commitAddress(): Promise<void> {
    const answer = await resolveDomain(addressDraft);
    const checked = validateAddress(answer.domain, answer.resolves);
    if (!checked.ok) {
      setAddressRefusal(checked.because);
      return;
    }
    setAddressRefusal(null);
    setEditingAddress(false);
    // REQ-026 c6: the card then stands by the address they gave — the
    // inferred market where a completed report exists for it, the empty
    // card where none does. A market they typed themselves is kept, which
    // is `onDomainChanged`'s rule, not this component's.
    setState((current) => onDomainChanged(current, { domain: checked.domain, report: answer.report }));
  }

  function commitMarket(): void {
    const category = marketDraft.trim();
    if (category === "") return;
    setState((current) => onMarketStated(current, category));
    setEditingMarket(false);
  }

  async function addTypedRival(): Promise<void> {
    const answer = await resolveDomain(rivalDraft);
    const result = addRival(state.rivals, {
      domain: answer.domain,
      origin: "typed",
      ownDomain: state.siteDomain,
      resolves: answer.resolves,
    });
    if (!result.ok) {
      setRivalRefusal(result.because);
      return;
    }
    setRivalRefusal(null);
    setRivalDraft("");
    setState((current) => ({ ...current, rivals: result.set }));
  }

  function toggleSuggested(domain: string): void {
    if (selected.has(domain)) {
      setState((current) => ({ ...current, rivals: removeRival(current.rivals, domain) }));
      setRivalRefusal(null);
      return;
    }
    // A suggestion came from the product's own derivation over the
    // founder's market, so there is nothing to resolve: `resolves` is
    // true by provenance, not by assumption.
    const result = addRival(state.rivals, {
      domain,
      origin: "suggested",
      ownDomain: state.siteDomain,
      resolves: true,
    });
    if (!result.ok) {
      setRivalRefusal(result.because);
      return;
    }
    setRivalRefusal(null);
    setState((current) => ({ ...current, rivals: result.set }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const checked = validateSetup(state);
    if (!checked.ok) {
      setSubmitRefusal(checked.because);
      return;
    }
    const category = settledCategory(state);
    if (state.siteDomain === null || category === null) {
      setSubmitRefusal("market_missing");
      return;
    }

    const submission: SetupSubmission = {
      domain: state.siteDomain,
      category,
      competitors: state.rivals.map((rival) => rival.domain),
      mode,
      destination:
        destination === "hosted" ? { kind: "hosted" } : { kind: "wordpress", connectLater: true },
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      });
      const body = (await response.json()) as SetupResult;
      // §4.3: the submit leads to the progress screen, which releases into
      // the app when the pass ends. A founder who had already completed
      // setup goes to the same place, and is asked nothing again
      // (REQ-025 c4).
      if (body.ok || body.refused === "already_complete") {
        router.push(WAITING_PATH);
        return;
      }
      setSubmitRefusal(body.refused);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="setup-form">
      <section data-testid="setup-address">
        <Card state="default" title={<Badge tone="neutral">{copy("setup.address.title")}</Badge>}>
          {state.address.state === "measured" && !editingAddress ? (
            <>
              <p className="num" data-testid="setup-address-value">
                {state.address.domain}
              </p>
              <p data-testid="setup-address-measured">{copy("setup.address.measured")}</p>
              <Btn
                label={copy("setup.address.change")}
                variant="ghost"
                size="sm"
                onClick={() => setEditingAddress(true)}
              />
            </>
          ) : (
            <>
              {addressRefusal === null ? (
                <Input
                  label={copy("setup.address.label")}
                  placeholder={copy("setup.address.placeholder")}
                  name="domain"
                  value={addressDraft}
                  onChange={setAddressDraft}
                />
              ) : (
                <Input
                  label={copy("setup.address.label")}
                  placeholder={copy("setup.address.placeholder")}
                  name="domain"
                  value={addressDraft}
                  onChange={setAddressDraft}
                  invalid
                  invalidMessage={copy(ADDRESS_REFUSAL_COPY[addressRefusal])}
                />
              )}
              <Btn
                label={copy("setup.address.change")}
                variant="ghost"
                size="sm"
                onClick={() => {
                  void commitAddress();
                }}
              />
            </>
          )}
        </Card>
      </section>

      <div className="rk-setup-cards">
        <section data-testid="setup-market">
          <Card state="default" title={<Badge tone="neutral">{copy("setup.market.title")}</Badge>}>
            {state.market.state === "empty" || editingMarket ? (
              <>
                {state.market.state === "empty" ? (
                  <p data-testid="setup-market-state-it">{copy("setup.market.state-it")}</p>
                ) : null}
                <Input
                  label={copy("setup.market.label")}
                  placeholder={copy("setup.market.placeholder")}
                  name="category"
                  value={marketDraft}
                  onChange={setMarketDraft}
                />
                <Btn
                  label={copy("setup.market.change")}
                  variant="ghost"
                  size="sm"
                  onClick={commitMarket}
                />
              </>
            ) : (
              <>
                <Badge tone="accent">
                  <span data-testid="setup-market-chip">{state.market.category}</span>
                </Badge>
                <Btn
                  label={copy("setup.market.change")}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMarketDraft(state.market.state === "empty" ? "" : state.market.category);
                    setEditingMarket(true);
                  }}
                />
              </>
            )}
          </Card>
        </section>

        <section data-testid="setup-competitors">
          <Card
            state="default"
            title={<Badge tone="neutral">{copy("setup.competitors.title")}</Badge>}
          >
            {state.suggestions.state === "awaiting_market" ? (
              <p data-testid="setup-competitors-awaiting">
                {copy("setup.competitors.awaiting-market")}
              </p>
            ) : null}
            {state.suggestions.state === "seeking" ? (
              <p data-testid="setup-competitors-seeking">{copy("setup.competitors.seeking")}</p>
            ) : null}
            {state.suggestions.state === "none_found" ? (
              <p data-testid="setup-competitors-none-found">
                {copy("setup.competitors.none-found")}
              </p>
            ) : null}

            <div className="rk-setup-chips" data-testid="setup-competitors-suggested">
              {state.suggestions.candidates.map((domain) => (
                <Btn
                  key={domain}
                  label={domain}
                  size="sm"
                  variant={selected.has(domain) ? "primary" : "ghost"}
                  disabled={full && !selected.has(domain)}
                  onClick={() => toggleSuggested(domain)}
                />
              ))}
            </div>

            <div className="rk-setup-chips" data-testid="setup-competitors-selected">
              {state.rivals.map((rival) => (
                <Btn
                  key={rival.domain}
                  label={rival.domain}
                  size="sm"
                  variant="primary"
                  onClick={() => toggleSuggested(rival.domain)}
                />
              ))}
            </div>

            <Divider />

            {rivalRefusal === null ? (
              <Input
                label={copy("setup.competitors.add.label")}
                placeholder={copy("setup.competitors.add.placeholder")}
                name="competitor"
                value={rivalDraft}
                onChange={setRivalDraft}
                disabled={full}
              />
            ) : (
              <Input
                label={copy("setup.competitors.add.label")}
                placeholder={copy("setup.competitors.add.placeholder")}
                name="competitor"
                value={rivalDraft}
                onChange={setRivalDraft}
                disabled={full}
                invalid
                invalidMessage={copy(RIVAL_REFUSAL_COPY[rivalRefusal])}
              />
            )}
            <Btn
              label={copy("setup.competitors.add.action")}
              variant="ghost"
              size="sm"
              disabled={full}
              onClick={() => {
                void addTypedRival();
              }}
            />
            {/* REQ-026 c9: the limit is stated on screen rather than
                silently enforced. Rendered in the numeral face for the
                same reason `PublishingCard` renders its date-bearing line
                there — the registry hands back one flat string, and
                marking half a sentence is worse than marking all of it. */}
            <p className="num" data-testid="setup-competitors-limit">
              {copy("setup.competitors.limit", { max: p.model.competitorsMax })}
            </p>
          </Card>
        </section>

        <section data-testid="setup-publishing">
          <Card
            state="default"
            title={<Badge tone="neutral">{copy("setup.publishing.title")}</Badge>}
          >
            <div className="rk-setup-chips" data-testid="setup-mode">
              {p.model.cards.mode.map((option) => (
                <Btn
                  key={option.mode}
                  label={copy(option.name)}
                  size="sm"
                  variant={mode === option.mode ? "primary" : "ghost"}
                  onClick={() => setMode(option.mode)}
                />
              ))}
            </div>
            {p.model.cards.mode.map((option) => (
              <p key={option.mode} data-testid={`setup-mode-line-${option.mode}`}>
                {copy(option.copy)}
              </p>
            ))}

            <Divider />

            <div className="rk-setup-chips" data-testid="setup-destination">
              {p.model.cards.destination.map((option) => (
                <Btn
                  key={option.kind}
                  label={copy(option.name)}
                  size="sm"
                  variant={destination === option.kind ? "primary" : "ghost"}
                  onClick={() => setDestination(option.kind)}
                />
              ))}
            </div>
            {p.model.cards.destination.map((option) => (
              <p key={option.kind} data-testid={`setup-destination-line-${option.kind}`}>
                {copy(option.copy)}
              </p>
            ))}

            {destination === "hosted" ? <HostedRecord dns={hostedDns(p.model)} /> : null}
          </Card>
        </section>
      </div>

      {submitRefusal === null ? null : (
        <p data-testid="setup-submit-refusal">{copy(SUBMIT_REFUSAL_COPY[submitRefusal])}</p>
      )}
      <Btn
        type="submit"
        label={copy("setup.submit")}
        variant="primary"
        inFlight={submitting}
        block
      />
    </form>
  );
}

/** The hosted option's `dns`, which the card type guarantees is present
 *  for `hosted` and one of exactly two shapes. */
function hostedDns(model: SetupScreenModel): DnsRecord | DnsPending {
  const hosted = model.cards.destination.find((option) => option.kind === "hosted");
  if (!hosted?.dns) {
    throw new Error("SetupForm: the hosted destination must always carry a dns shape.");
  }
  return hosted.dns;
}

/** REQ-028 c2: the record once the site address is known, and one written
 *  line where it is not — never a blank, a dash or a placeholder. */
function HostedRecord(p: { dns: DnsRecord | DnsPending }): React.JSX.Element {
  if ("pending" in p.dns) {
    return <p data-testid="setup-dns-pending">{copy(p.dns.copy)}</p>;
  }
  return (
    <>
      <p data-testid="setup-dns-caption">{copy("setup.destination.dnsRecord")}</p>
      <p className="num rk-setup-dns" data-testid="setup-dns-record">
        <span>{p.dns.type}</span>
        <span>{p.dns.name}</span>
        <span>{p.dns.value}</span>
      </p>
    </>
  );
}
