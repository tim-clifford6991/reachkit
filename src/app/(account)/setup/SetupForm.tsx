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

import type React from "react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import {
  settledCategory,
  validateSetup,
  type SetupState,
} from "@/lib/market/setup/state";
import {
  preselected,
  type DestinationKind,
  type PublishingMode,
} from "@/lib/publish/setup/cards";
import { MarketCard } from "./MarketCard";
import { ProfileCard } from "./ProfileCard";
import { PublishingCard } from "./PublishingCard";
import { RivalsCard } from "./RivalsCard";
import type { SetupScreenModel } from "./_setup/facts";
import type { SetupRefusal, SetupSubmission } from "./submit";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";
import type { SetupResult } from "./submit";

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
  // SPEC §5's pair, refused a second time at the submit because an answer
  // from a browser is not a fact. Each keeps its own line: one asks the
  // founder to type a label, the other to type a different one.
  invalid_label: "setup.destination.label.refused.invalid",
  label_taken: "setup.destination.label.refused.taken",
} as const satisfies Record<
  | Exclude<SetupRefusal, "already_complete">
  | "address_missing"
  | "market_missing",
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
  // SPEC.md §5 (2026-09-12): the voice as the founder will leave it —
  // what the scan read, until they type over it. Held here with the other
  // drafts because it is the same kind of thing: text a founder is
  // part-way through, which only the one submit stores.
  const [voiceDraft, setVoiceDraft] = useState(
    p.model.profile?.voice?.text ?? "",
  );
  const [mode, setMode] = useState<PublishingMode>(defaults.mode);
  const [destination, setDestination] = useState<DestinationKind>(
    defaults.destination,
  );
  // SPEC §5 (2026-09-12): the subdomain label is the customer's, and the
  // card is drawn with the default until they change it. The value the
  // screen opens on is the one the cards were composed with, so what they
  // were shown and what they submit are one fact read twice.
  const [label, setLabel] = useState(hostedLabel(p.model));
  const [submitRefusal, setSubmitRefusal] = useState<
    keyof typeof SUBMIT_REFUSAL_COPY | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
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
        destination === "hosted"
          ? { kind: "hosted", label }
          : { kind: "wordpress", connectLater: true },
      voiceText: voiceDraft,
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
    <form onSubmit={handleSubmit} data-testid="setup-form" className="grid gap-4">
      <MarketCard
        state={state}
        setState={setState}
        questions={p.model.questions}
        resolveDomain={resolveDomain}
      />

      <RivalsCard
        rivals={state.rivals}
        suggestions={state.suggestions}
        ownDomain={state.siteDomain}
        max={p.model.competitorsMax}
        resolveDomain={resolveDomain}
        onRivals={(rivals) => setState((current) => ({ ...current, rivals }))}
      />

      {/* No profile, no card: a founder who bought with no report behind
          them has had nothing read yet. */}
      {p.model.profile === null ? null : (
        <ProfileCard profile={p.model.profile} voice={voiceDraft} onVoice={setVoiceDraft} />
      )}

      <PublishingCard
        cards={p.model.cards}
        siteDomain={state.siteDomain}
        cnameTarget={p.model.cnameTarget}
        mode={mode}
        onMode={setMode}
        destination={destination}
        onDestination={setDestination}
        label={label}
        onLabel={setLabel}
      />

      {submitRefusal === null ? null : (
        <div role="alert" className="alert alert-error alert-soft text-sm" data-testid="setup-submit-refusal">
          {copy(SUBMIT_REFUSAL_COPY[submitRefusal])}
        </div>
      )}
      {/* The screen's one solid primary. */}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={submitting}
        aria-busy={submitting}
      >
        {copy("setup.submit")}
      </button>
      {/* REQ-021 c10, centred under the one control. */}
      <p className="text-center text-sm text-base-content/70" data-testid="setup-footer-line">
        {copy("setup.footer.line")}
      </p>
    </form>
  );
}

/** The label the hosted card was composed with — the founder's own, or
 *  the default they have not changed. Read off the card rather than named
 *  again here, so "the value they were shown" and "the value the field
 *  opens on" are one fact (SPEC §5). */
function hostedLabel(model: SetupScreenModel): string {
  const hosted = model.cards.destination.find(
    (option) => option.kind === "hosted",
  );
  if (hosted?.label === undefined) {
    throw new Error(
      "SetupForm: the hosted destination must always carry a subdomain label.",
    );
  }
  return hosted.label;
}
