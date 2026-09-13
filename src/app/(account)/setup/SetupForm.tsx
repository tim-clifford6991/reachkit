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
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/ui/components/Btn";
import { Badge } from "@/ui/components/Badge";
import { Input } from "@/ui/components/Input";
import { Divider } from "@/ui/components/Divider";
import { BookOpen, Globe, Sparkles, Users } from "lucide-react";
import { CardHead, IdiomCard, OptionCard, RemovableTag } from "@/ui/idiom";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  onDomainChanged,
  onMarketStated,
  settledCategory,
  validateAddress,
  validateSetup,
  type AddressRefusal,
  type SetupState,
} from "@/lib/market/setup/state";
import {
  addRival,
  isFull,
  removeRival,
  type RivalRefusal,
} from "@/lib/market/setup/rivals";
import {
  dnsRecordFor,
  preselected,
  type DestinationKind,
  type DnsPending,
  type DnsRecord,
  type PublishingMode,
} from "@/lib/publish/setup/cards";
import { purposeCounts, type PagePurpose } from "@/lib/site-profile/types";
import { checkLabel, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import { checkSubdomainLabel } from "./label-actions";
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

/** SPEC §5's two refusals, as written lines. The same two keys the
 *  submit's own refusals resolve to: one sentence per refusal, wherever it
 *  is found, so the screen and the server cannot word the same refusal two
 *  ways. */
const LABEL_REFUSAL_COPY = {
  not_a_label: "setup.destination.label.refused.invalid",
  taken: "setup.destination.label.refused.taken",
} as const satisfies Record<LabelRefusal, string>;

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
  const [addressDraft, setAddressDraft] = useState(
    p.model.state.siteDomain ?? "",
  );
  const [addressRefusal, setAddressRefusal] = useState<AddressRefusal | null>(
    null,
  );
  const [editingAddress, setEditingAddress] = useState(
    p.model.state.address.state !== "measured",
  );
  // Canvas: OnboardingMarket — the field holds the market, so it opens on
  // what the scan inferred and what it holds is what the one submit sends.
  const [marketDraft, setMarketDraft] = useState(
    settledCategory(p.model.state) ?? "",
  );
  // SPEC.md §5 (2026-09-12): the voice as the founder will leave it —
  // what the scan read, until they type over it. Held here with the other
  // drafts because it is the same kind of thing: text a founder is
  // part-way through, which only the one submit stores.
  const [voiceDraft, setVoiceDraft] = useState(
    p.model.profile?.voice?.text ?? "",
  );
  const [rivalDraft, setRivalDraft] = useState("");
  const [rivalRefusal, setRivalRefusal] = useState<RivalRefusal | null>(null);
  const [mode, setMode] = useState<PublishingMode>(defaults.mode);
  const [destination, setDestination] = useState<DestinationKind>(
    defaults.destination,
  );
  // SPEC §5 (2026-09-12): the subdomain label is the customer's, and the
  // card is drawn with the default until they change it. The value the
  // screen opens on is the one the cards were composed with, so what they
  // were shown and what they submit are one fact read twice.
  const [label, setLabel] = useState(hostedLabel(p.model));
  const [labelRefusal, setLabelRefusal] = useState<LabelRefusal | null>(null);
  /** Which availability question is the current one. A founder types
   *  faster than a round trip answers, and an older answer landing last
   *  would refuse a label they have already changed. */
  const labelAsked = useRef(0);
  const [submitRefusal, setSubmitRefusal] = useState<
    keyof typeof SUBMIT_REFUSAL_COPY | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = new Set(state.rivals.map((rival) => rival.domain));
  const full = isFull(state.rivals);

  // REQ-028 c2, and SPEC §5's "appears as soon as the site address is
  // known": the record is composed here rather than read off the server's
  // model, because both halves of its name move while the founder is on
  // this screen — they type their address, and they choose their label.
  // The one thing the screen cannot derive is the target it points at,
  // which is a deployment binding and rides on the model.
  const dns: DnsRecord | DnsPending = dnsRecordFor({
    siteDomain: state.siteDomain,
    cnameTarget: p.model.cnameTarget,
    label,
  });

  /** The label, as the founder types it. The shape is decided here and at
   *  once; whether the host is free is a row, and is asked of the server
   *  with the newest answer winning. */
  async function draftLabel(next: string): Promise<void> {
    setLabel(next);
    const shape = checkLabel(next);
    if (!shape.ok) {
      setLabelRefusal(shape.because);
      return;
    }
    setLabelRefusal(null);
    labelAsked.current += 1;
    const asked = labelAsked.current;
    // SPEC §5's second question — whether anybody else already serves at
    // the host this label composes — is a row, so it is the Server
    // Function's. A call that does not complete refuses nothing: the
    // submit asks the same question against the canonical domain and is
    // what actually decides, so a blip here must not stand between a
    // founder and a label nobody holds.
    let refusal: LabelRefusal | null = null;
    try {
      refusal = (await checkSubdomainLabel({ label: next, domain: state.siteDomain })).refusal;
    } catch {
      refusal = null;
    }
    if (asked !== labelAsked.current) return;
    setLabelRefusal(refusal);
  }

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
    setState((current) =>
      onDomainChanged(current, {
        domain: checked.domain,
        report: answer.report,
      }),
    );
  }

  /** Typing states the market, which is `onMarketStated`'s own transition:
   *  the rivals suggested for the market they have left stop being offered.
   *  An emptied field states nothing, and the one submit refuses it. */
  function draftMarket(next: string): void {
    setMarketDraft(next);
    const stated = next.trim();
    if (stated === "") return;
    setState((current) => onMarketStated(current, stated));
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
      setState((current) => ({
        ...current,
        rivals: removeRival(current.rivals, domain),
      }));
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const checked = validateSetup(state);
    if (!checked.ok) {
      setSubmitRefusal(checked.because);
      return;
    }
    // The field is the market, so the field is what is sent: a founder who
    // cleared it has stated none, whatever the card last settled on.
    const category = marketDraft.trim();
    if (state.siteDomain === null || category === "") {
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

  // The cards are separated by the frame, not by their own shadow:
  // `--shadow-card` is a hairline, and two `--surface` cards flush against
  // each other read as one box — which is how this screen first rendered
  // once the `<section>` wrappers went. `gap-4` is `--s-4`, the rhythm the
  // set draws, as a Tailwind utility because §2.2 allows this screen no
  // stylesheet of its own.
  return (
    <form onSubmit={handleSubmit} data-testid="setup-form" className="grid gap-4">
      <IdiomCard
        head={
          <CardHead
            icon={<Globe aria-hidden size={ICON} />}
            eyebrow={copy("setup.address.title")}
          />
        }
        testId={ADDRESS_TEST_ID}
      >
        {state.address.state === "measured" && !editingAddress ? (
          <>
            <p className="num" data-testid="setup-address-value">
              {state.address.domain}
            </p>
            <p data-testid="setup-address-measured">
              {copy("setup.address.measured")}
            </p>
            <Btn
              label={copy("setup.address.change")}
              variant="secondary"
              size="sm"
              pill
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
              variant="secondary"
              size="sm"
              pill
              onClick={() => {
                void commitAddress();
              }}
            />
            {/* REQ-021 c7's own promise, and the set's own sentence for it:
                the address they paid with is not assumed to be the site. */}
            <p className="rk-quiet" data-testid="setup-address-assurance">
              {copy("setup.address.assurance")}
            </p>
          </>
        )}
      </IdiomCard>

      {/* Canvas: OnboardingMarket — the market is its own card, and the
          category a field holding what the scan inferred rather than a chip
          behind a Change. Before the site is given there is nothing to infer
          from, so the card says when its suggestion arrives instead. */}
      <div
        data-testid="setup-market"
        data-awaiting={state.address.state === "measured" ? undefined : "site"}
      >
        <IdiomCard
          head={
            <CardHead
              icon={<Globe aria-hidden size={ICON} />}
              eyebrow={copy("setup.market.title")}
            />
          }
        >
          {state.address.state !== "measured" ? (
            <p
              className="t-sm text-(color:--ink-2)"
              data-testid="setup-market-awaiting-site"
            >
              {copy("setup.market.awaiting-site")}
            </p>
          ) : (
            <>
              <Input
                mono
                label={copy("setup.market.label")}
                placeholder={copy("setup.market.placeholder")}
                name="category"
                value={marketDraft}
                onChange={draftMarket}
              />
              <p
                className="t-sm text-(color:--ink-2)"
                data-testid="setup-market-state-it"
              >
                {copy("setup.market.state-it")}
              </p>
            </>
          )}
        </IdiomCard>
      </div>

      <IdiomCard
        head={
          <CardHead
            icon={<Users aria-hidden size={ICON} />}
            eyebrow={copy("setup.competitors.title")}
            // REQ-026 c9's limit, stated on screen — and the set puts it
            // in the card's head as "n of 5" rather than in a line under
            // the field, so the count is beside the thing it counts.
            pill={
              <Badge tone="neutral">
                <span className="num" data-testid="setup-competitors-limit">
                  {copy("setup.competitors.limit", {
                    chosen: state.rivals.length,
                    max: p.model.competitorsMax,
                  })}
                </span>
              </Badge>
            }
          />
        }
        testId={COMPETITORS_TEST_ID}
      >
        {state.suggestions.state === "awaiting_market" ? (
          <p data-testid="setup-competitors-awaiting">
            {copy("setup.competitors.awaiting-market")}
          </p>
        ) : null}
        {state.suggestions.state === "seeking" ? (
          <p data-testid="setup-competitors-seeking">
            {copy("setup.competitors.seeking")}
          </p>
        ) : null}
        {state.suggestions.state === "none_found" ? (
          <p data-testid="setup-competitors-none-found">
            {copy("setup.competitors.none-found")}
          </p>
        ) : null}

        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="setup-competitors-suggested"
        >
          {state.suggestions.candidates.map((domain) => (
            <Btn
              key={domain}
              label={domain}
              size="sm"
              variant="secondary"
              pill
              pressed={selected.has(domain)}
              disabled={full && !selected.has(domain)}
              onClick={() => toggleSuggested(domain)}
            />
          ))}
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="setup-competitors-selected"
        >
          {/* The chosen set, as the set draws it: mono tags on the accent
              tint, each with the × that removes it (REQ-026 c7). A removal
              control rather than a toggle — `RemovableTag` says why it is
              not `Btn` with `aria-pressed`, which the suggestions above
              still are. */}
          {state.rivals.map((rival) => (
            <RemovableTag
              key={rival.domain}
              value={rival.domain}
              removeLabel={copy("setup.competitors.remove", { rival: rival.domain })}
              onRemove={() => toggleSuggested(rival.domain)}
            />
          ))}
        </div>

        <Divider />

        {rivalRefusal === null ? (
          <Input
            label={copy("setup.competitors.add.label")}
            placeholder={copy(
              ADD_PLACEHOLDER[state.rivals.length === 0 ? "first" : "another"],
            )}
            name="competitor"
            value={rivalDraft}
            onChange={setRivalDraft}
            disabled={full}
          />
        ) : (
          <Input
            label={copy("setup.competitors.add.label")}
            placeholder={copy(
              ADD_PLACEHOLDER[state.rivals.length === 0 ? "first" : "another"],
            )}
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
          variant="tertiary"
          size="sm"
          pill
          disabled={full}
          onClick={() => {
            void addTypedRival();
          }}
        />
      </IdiomCard>

      {/* SPEC.md §5 (2026-09-12) — "Your site, as we read it". The
          inventory and the site name are shown **as read**: there is no
          control to correct them here, because they are a reading, not a
          decision. The one thing the founder may change is the voice,
          which is what everything written for them will sound like.

          No profile, no card. A scan has built one for every founder who
          arrived from a report; one who bought with no report behind them
          has nothing read yet, and an empty card claiming to have read
          their site would be a lie the screen tells on its own. */}
      {p.model.profile === null ? null : (
        <IdiomCard
          head={
            <CardHead
              icon={<BookOpen aria-hidden size={ICON} />}
              eyebrow={copy("setup.profile.title")}
              pill={
                <Badge tone="accent">
                  <span className="num" data-testid="setup-profile-pages">
                    {copy("setup.profile.pages-read", {
                      pages: p.model.profile.pagesRead,
                    })}
                  </span>
                </Badge>
              }
            />
          }
          testId={PROFILE_TEST_ID}
        >
          {/* Canvas: OnboardingMarket draws the name under its own eyebrow
              at the card-head rung, beside the domain it was read from. */}
          <div style={ROW}>
            {p.model.profile.siteName === null ? null : (
              <span className="flex flex-col gap-(--s-1)">
                <span className="eyebrow text-(color:--ink-3)">
                  {copy("setup.profile.site-name")}
                </span>
                <span
                  className="text-(length:--h3) font-semibold"
                  data-testid="setup-profile-site-name"
                >
                  {p.model.profile.siteName}
                </span>
              </span>
            )}
            <p
              className="num text-(color:--ink-3)"
              data-testid="setup-profile-domain"
            >
              {p.model.profile.domain}
            </p>
          </div>

          <p className="rk-quiet">{copy("setup.profile.purposes")}</p>
          {/* One chip per purpose that actually occurs, with its count.
              `purposeCounts` drops the purposes with no pages — an empty
              count is not a fact worth a chip. */}
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="setup-profile-purposes"
          >
            {purposeCounts(p.model.profile.inventory).map((entry) => (
              <Badge key={entry.purpose} tone="accent">
                {/* The word and its count are two elements with a gap
                    between them, never a space typed as a JSX child: a
                    string literal on a surface is a product sentence to
                    the copy sweep, and it is right to say so. */}
                <span className="flex items-center gap-2">
                  <span data-testid={`setup-profile-purpose-${entry.purpose}`}>
                    {copy(PURPOSE_COPY[entry.purpose])}
                  </span>
                  <span className="num">{entry.count}</span>
                </span>
              </Badge>
            ))}
          </div>

          <Input
            multiline
            label={copy("setup.profile.voice.label")}
            name="voice_text"
            value={voiceDraft}
            onChange={setVoiceDraft}
          />
          <p className="rk-quiet" data-testid="setup-profile-voice-later">
            {copy("setup.profile.voice.later")}
          </p>
        </IdiomCard>
      )}

      <IdiomCard
        head={
          <CardHead
            icon={<Sparkles aria-hidden size={ICON} />}
            eyebrow={copy("setup.publishing.title")}
          />
        }
        testId={PUBLISHING_TEST_ID}
      >
        {/* Two option pairs, as the set draws them: the mode, a rule, the
              destination. Each card carries its own line, and the hosted
              destination carries its CNAME record inside the option it
              belongs to rather than under the whole card. */}
        <div className="rk-pick" data-testid="setup-mode">
          {p.model.cards.mode.map((option) => (
            <OptionCard
              key={option.mode}
              title={copy(option.name)}
              line={copy(option.copy)}
              chosen={mode === option.mode}
              badge={
                option.preselected ? copy("setup.mode.default") : undefined
              }
              onChoose={() => setMode(option.mode)}
              testId={`setup-mode-${option.mode}`}
            />
          ))}
        </div>

        <Divider />

        {/* Canvas: OnboardingPublishing — the pair, each card carrying what
            choosing it involves: the hosted card its record and the state
            that record is in, the WordPress card what connecting will ask
            for. The chosen one carries the set's own `default`. */}
        <div className="rk-pick" data-testid="setup-destination">
          {p.model.cards.destination.map((option) => (
            <OptionCard
              key={option.kind}
              title={copy(option.name)}
              line={copy(option.copy)}
              chosen={destination === option.kind}
              badge={option.preselected ? copy("setup.mode.default") : undefined}
              onChoose={() => setDestination(option.kind)}
              testId={`setup-destination-${option.kind}`}
            >
              {option.kind === "hosted" ? <HostedRecord dns={dns} /> : null}
              {option.kind === "wordpress" ? (
                <WordPressAsks domain={state.siteDomain} />
              ) : null}
            </OptionCard>
          ))}
        </div>

        {/* SPEC §5 (2026-09-12): the label the founder chooses, and the
            record above it moves with every keystroke. It sits under the
            pair rather than inside the hosted card because that card is a
            `<button>` — the approved artboard draws the field within it,
            and a form control nested in a button is neither valid markup
            nor operable by keyboard. Named in the PR. */}
        {destination === "hosted" ? (
          <div data-testid="setup-destination-label">
            {labelRefusal === null ? (
              <Input
                mono
                label={copy("setup.destination.label.label")}
                name="label"
                value={label}
                onChange={(next) => {
                  void draftLabel(next);
                }}
              />
            ) : (
              <Input
                mono
                label={copy("setup.destination.label.label")}
                name="label"
                value={label}
                onChange={(next) => {
                  void draftLabel(next);
                }}
                invalid
                invalidMessage={copy(LABEL_REFUSAL_COPY[labelRefusal])}
              />
            )}
          </div>
        ) : null}
      </IdiomCard>

      {submitRefusal === null ? null : (
        <p data-testid="setup-submit-refusal">
          {copy(SUBMIT_REFUSAL_COPY[submitRefusal])}
        </p>
      )}
      <Btn
        type="submit"
        label={copy("setup.submit")}
        variant="primary"
        pill
        inFlight={submitting}
        block
      />
      {/* REQ-021 c10, and the set's own sentence for it, centred under the
          one control. */}
      <p className="rk-quiet" style={CENTRED} data-testid="setup-footer-line">
        {copy("setup.footer.line")}
      </p>
    </form>
  );
}

/** The chip's glyph size — 14px inside `.rk-head-chip`'s 32px square. */
const ICON = 14;

/** A test hook, bound to a name for the copy sweep's reason. */
const ADDRESS_TEST_ID = "setup-address";
const COMPETITORS_TEST_ID = "setup-competitors";
const PROFILE_TEST_ID = "setup-profile";
const PUBLISHING_TEST_ID = "setup-publishing";

/** A settled row: the value, and the one control that changes it. */
const ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  minWidth: 0,
};

const CENTRED: React.CSSProperties = { textAlign: "center" };

/** The add field's two placeholders. The set asks for the first rival by
 *  example and for the next by "another"; the arm is the count, so no call
 *  site chooses a sentence. */
const ADD_PLACEHOLDER = {
  first: "setup.competitors.add.placeholder.first",
  another: "setup.competitors.add.placeholder",
} as const satisfies Record<string, CopyKey>;

/** SPEC.md §2's eight purposes, each as the key whose word a customer
 *  reads. A record rather than a template so the key is a `CopyKey` the
 *  registry checks, and so an engine token can never reach a screen as
 *  itself — the same reason `ADD_PLACEHOLDER` above is a record. */
const PURPOSE_COPY = {
  pricing: "setup.profile.purpose.pricing",
  about: "setup.profile.purpose.about",
  features: "setup.profile.purpose.features",
  product: "setup.profile.purpose.product",
  blog: "setup.profile.purpose.blog",
  contact: "setup.profile.purpose.contact",
  legal: "setup.profile.purpose.legal",
  other: "setup.profile.purpose.other",
} as const satisfies Record<PagePurpose, CopyKey>;

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

/** REQ-028 c2: the record once the site address is known, and one written
 *  line where it is not — never a blank, a dash or a placeholder. */
function HostedRecord(p: { dns: DnsRecord | DnsPending }): React.JSX.Element {
  if ("pending" in p.dns) {
    return <p data-testid="setup-dns-pending">{copy(p.dns.copy)}</p>;
  }
  return (
    <>
      <span className={ASK_LINE} data-testid="setup-dns-caption">
        {copy("setup.destination.dnsRecord")}
      </span>
      {/* Canvas: OnboardingPublishing — the record in its own inset box,
          the hostname's state beside it. The state is `waiting`: the host
          cannot resolve before the customer creates the record they are
          being shown, and settings reads the same two words back. */}
      <span className={RECORD_BOX}>
        {/* §2.2 allows no stylesheet here, so the record wraps with
            utilities: `wrap-anywhere` is Tailwind's `overflow-wrap:
            anywhere` — ADR-093 check 3 treats any clipped mono element as
            an offender whatever an allow-list says, so a record longer
            than a 320px column has to break inside its own box rather
            than hide behind a scrollbar. */}
        <span
          className="num flex min-w-0 flex-wrap gap-(--s-2)"
          data-testid="setup-dns-record"
        >
          <span className="min-w-0 wrap-anywhere">{p.dns.name}</span>
          <span className="min-w-0 wrap-anywhere">{p.dns.type}</span>
          <span className="min-w-0 wrap-anywhere">{p.dns.value}</span>
        </span>
        <Badge tone="warn">
          <span data-testid="setup-dns-state">
            {copy("settings.destination.hostname.waiting")}
          </span>
        </Badge>
      </span>
    </>
  );
}

/** Canvas: OnboardingPublishing — what connecting WordPress asks for, on
 *  the card that offers it. Shown, never asked here: §5 keeps the connect
 *  itself for settings ("connect later"), and setup's fields are the three
 *  decisions and no fourth. */
function WordPressAsks(p: { domain: string | null }): React.JSX.Element {
  return (
    <>
      <span className={ASK}>
        <span className={ASK_LINE}>{copy("settings.destination.site-url")}</span>
        {p.domain === null ? null : (
          <span className="num wrap-anywhere" data-testid="setup-wordpress-site">
            {p.domain}
          </span>
        )}
      </span>
      <span className={ASK}>
        <span className={ASK_LINE}>
          {copy("settings.destination.app-password")}
        </span>
        <span className="explain" data-testid="setup-wordpress-help">
          {copy("settings.destination.app-password.help")}
        </span>
      </span>
    </>
  );
}

/** A card's own quiet line, at the set's `--t-sm` rung. */
const ASK_LINE = "mt-(--s-3) block text-(length:--t-sm) text-(color:--ink-2)";

/** One thing a destination asks for: what it is called, then what it holds. */
const ASK = "mt-(--s-3) flex min-w-0 flex-col";

/** The record's inset box: the accent hairline the set draws around it, the
 *  value, and the state the hostname is in. */
const RECORD_BOX =
  "mt-(--s-2) flex flex-wrap items-center justify-between gap-(--s-3) rounded-(--r-field) border border-(color:--accent-line) bg-(--surface) p-(--s-3)";
