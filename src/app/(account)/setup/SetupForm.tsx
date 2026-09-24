// SPEC §5 (2026-09-20, #908) — setup, as five saved steps.
//
// "setup is **five saved steps** — your site, your business, rivals, your
// voice, publishing — one decision each, with Back, and an equal-column
// step indicator … Each step saves as it is left so a reload resumes;
// finishing reaches the app at once."
//
// This file is the whole of the wizard and holds no rule of its own:
//
//   which step is on screen   the URL (`?step=`, held by `nuqs` —
//                             `docs/DESIGN.md`'s library list). A reload, a
//                             browser Back and a shared address all resume
//                             on it; `model.openAt` is where a founder who
//                             closed the tab comes back to.
//   what a step may hold      `@/lib/market/setup/*`, unchanged: which
//                             market card renders, what a domain change
//                             clears, what a rival refusal is called.
//   what leaving one writes   `POST /api/setup` with that step's own body
//                             (`SetupStepSave`), and the finish with the
//                             whole submission.
//
// **Every refusal is one line, and the step keeps it.** A step that is
// refused does not advance; the line sits under the question, in the same
// words the finish would use for the same refusal.
//
// **Nothing on any step waits on the pass.** The deep pass is sent when the
// rivals step is saved (SPEC §5, 2026-09-20), so the voice and publishing
// steps overlap the wait — the founder is never held at a control.
//
// **One network round-trip decides a domain.** Unchanged from the one-screen
// setup: whether an address resolves in DNS (REQ-021 c9) and its canonical
// eTLD+1 are both `POST /api/setup/domain`'s, because the parser imports
// `node:net` and cannot be bundled for a browser at all.
//
// **Rivals are sought again whenever the address or the market changes**
// (issue 750): `POST /api/setup/rivals` answers for the address and market
// on screen, an answer for an address the founder has since replaced is
// dropped, and a request that fails settles the card as none found.
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ArrowLeft, Check } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  onSuggestionsSettled,
  settledCategory,
  validateSetup,
  type SetupState,
} from "@/lib/market/setup/state";
import { preselected, type DestinationKind } from "@/lib/publish/setup/cards";
import type { PagePurpose } from "@/lib/site-profile/types";
import { businessFrom, jobFrom, type BusinessDraft } from "./_setup/business";
import { MarketCard } from "./MarketCard";
import { PublishingCard } from "./PublishingCard";
import { RivalsCard } from "./RivalsCard";
import { PassStatusLine } from "./PassStatusLine";
import { SetupPanel } from "./SetupPanel";
import { VoiceCard } from "./VoiceCard";
import {
  isLastStep,
  nextStep,
  previousStep,
  SETUP_STEPS,
  stepIndex,
  type SetupStepId,
} from "./steps";
import type { SetupScreenModel } from "./_setup/facts";
import type { SetupRefusal, SetupResult, SetupStepResult, SetupSubmission } from "./submit";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";
import type { SeekRivalsResponse } from "@/app/api/setup/rivals/route";

/** Every refusal the founder can be shown, as a written line. `SetupResult`'s
 *  `already_complete` is absent on purpose: a founder who has completed
 *  setup is *taken onward* (REQ-025 c4), never shown a refusal. */
const REFUSAL_COPY = {
  address_missing: "setup.address.missing",
  market_missing: "setup.market.missing",
  invalid_domain: "setup.address.refused.unreachable",
  no_active_access: "setup.refused.no-access",
  too_many_competitors: "setup.competitors.refused.set-full",
  invalid_label: "setup.destination.label.refused.invalid",
  label_taken: "setup.destination.label.refused.taken",
} as const satisfies Record<
  Exclude<SetupRefusal, "already_complete"> | "address_missing" | "market_missing",
  CopyKey
>;

/** The one-word label on each column of the indicator. */
const STEP_LABEL = {
  site: "setup.step.site",
  business: "setup.step.business",
  rivals: "setup.step.rivals",
  voice: "setup.step.voice",
  publishing: "setup.step.publishing",
} as const satisfies Record<SetupStepId, CopyKey>;

/** The question each step asks, and the line under it. */
const STEP_QUESTION = {
  site: "setup.step.site.question",
  business: "setup.step.business.question",
  rivals: "setup.step.rivals.question",
  voice: "setup.step.voice.question",
  publishing: "setup.step.publishing.question",
} as const satisfies Record<SetupStepId, CopyKey>;

/** SPEC §2's eight purposes, each as the key whose word a customer reads,
 *  so an engine token never reaches the screen as itself. */
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

/** Where the finish leads. Internal route names, not customer-visible
 *  strings.
 *
 *  Straight into the app, the pass already running (issue #782) — except
 *  for a founder publishing to the hosted blog, who is carried to the one
 *  step that comes after setup: the DNS record (#924, SPEC §5 2026-09-20).
 *  That screen sends them on itself for a host that is already live or has
 *  no record to make, so this never lands anybody on a screen about
 *  nothing, and *Do this later* on it leads here. */
const APP_PATH = "/app";
const CONNECT_PATH = "/setup/connect";

const QUIET = "text-sm text-base-content/70";
const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

async function resolveDomain(host: string): Promise<ResolveDomainResponse> {
  const response = await fetch("/api/setup/domain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ host }),
  });
  return (await response.json()) as ResolveDomainResponse;
}

async function seekRivals(domain: string, category: string | null): Promise<SeekRivalsResponse> {
  const response = await fetch("/api/setup/rivals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain, category }),
  });
  if (!response.ok) throw new Error(`POST /api/setup/rivals: ${response.status}`);
  return (await response.json()) as SeekRivalsResponse;
}

/** The market the server is asked about: the one stated, or `null` for the
 *  one the address's own report infers. */
function statedCategory(state: SetupState): string | null {
  return state.market.state === "stated" ? state.market.category : null;
}

export function SetupForm(p: { model: SetupScreenModel }): React.JSX.Element {
  const router = useRouter();
  const defaults = preselected(p.model.cards);

  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(SETUP_STEPS).withDefault(p.model.openAt),
  );
  const [state, setState] = useState<SetupState>(p.model.state);
  const [business, setBusiness] = useState<BusinessDraft>(() => businessFrom(p.model.business));
  const [job, setJob] = useState(() => jobFrom(p.model.business));
  // SPEC.md §5 (2026-09-12): the voice as the founder will leave it — what
  // the scan read, or what they already saved over it.
  const [voiceDraft, setVoiceDraft] = useState(p.model.voiceText);
  const [destination, setDestination] = useState<DestinationKind>(defaults.destination);
  // SPEC §5 (2026-09-12): the subdomain label is the customer's, and the
  // card is drawn with the default until they change it.
  const [label, setLabel] = useState(hostedLabel(p.model));
  const [refusal, setRefusal] = useState<keyof typeof REFUSAL_COPY | null>(null);
  const [saving, setSaving] = useState(false);

  // The address given and the market known, as the server is asked about
  // them. The screen opens settled — a free upgrade's rivals came with the
  // page — so a request goes only once one of these moves.
  const soughtDomain = state.siteDomain;
  const soughtCategory = statedCategory(state);
  const unsettled =
    state.suggestions.state === "seeking" || state.suggestions.state === "awaiting_market";
  useEffect(() => {
    if (soughtDomain === null || !unsettled) return;
    let current = true;
    seekRivals(soughtDomain, soughtCategory)
      .then(
        (answer) => answer.candidates,
        (): readonly string[] => [],
      )
      .then((candidates) => {
        if (!current) return;
        setState((now) => {
          if (now.siteDomain !== soughtDomain || statedCategory(now) !== soughtCategory) return now;
          // Only a card that is seeking settles. `null` — no market known —
          // leaves a card waiting on its market as it is; a seeking card
          // told there is none settles as none found rather than seeking on.
          if (now.suggestions.state !== "seeking") return now;
          return onSuggestionsSettled(now, candidates ?? []);
        });
      });
    return () => {
      current = false;
    };
  }, [soughtDomain, soughtCategory, unsettled]);

  /** The whole of what the finish carries — the five steps' answers as one
   *  closed shape (REQ-025 c1). `null` where an answer the finish needs is
   *  still missing, with the refusal that says which. */
  function submission():
    | { ok: true; submission: SetupSubmission }
    | { ok: false; because: keyof typeof REFUSAL_COPY } {
    const checked = validateSetup(state);
    if (!checked.ok) return { ok: false, because: checked.because };
    const category = settledCategory(state);
    if (state.siteDomain === null || category === null) {
      return { ok: false, because: "market_missing" };
    }
    return {
      ok: true,
      submission: {
        domain: state.siteDomain,
        category,
        competitors: state.rivals.map((rival) => rival.domain),
        destination:
          destination === "hosted"
            ? { kind: "hosted", label }
            : { kind: "wordpress", connectLater: true },
        voiceText: voiceDraft,
        // Issue #783: the site has a zone before its first draft is selected.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  /** What leaving this step writes. `null` for a step whose answer the
   *  finish carries — publishing, which is the last. */
  function stepBody(): Record<string, unknown> | null {
    switch (step) {
      case "site": {
        const checked = validateSetup(state);
        if (!checked.ok) return null;
        return { step, domain: state.siteDomain, category: settledCategory(state) };
      }
      case "business":
        // #970: the lists as the founder left them, and #1038 *What you do*. What is *stored*
        // is what they took out and what they added, which the server works
        // out against the same reading this screen was drawn from — the
        // browser never names a decision it did not make.
        return { step, lists: business, job };
      case "rivals":
        return { step, competitors: state.rivals.map((rival) => rival.domain) };
      case "voice":
        return {
          step,
          voiceText: voiceDraft,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      case "publishing":
        return null;
    }
  }

  async function post<T>(body: unknown): Promise<T> {
    const response = await fetch("/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  }

  /** Leaving the step forward: the step's own save, then the next step — or,
   *  on the last, the finish. */
  async function onwards(): Promise<void> {
    if (saving) return;
    const after = nextStep(step);

    if (after === null) {
      const carried = submission();
      if (!carried.ok) {
        setRefusal(carried.because);
        return;
      }
      setSaving(true);
      try {
        const answer = await post<SetupResult>({ step: "finish", ...carried.submission });
        // Issue #782: the finish leads straight into the app, where the side
        // panel says which step of the pass is under way. A founder who had
        // already completed setup goes to the same place (REQ-025 c4).
        if (answer.ok || answer.refused === "already_complete") {
          // #924: the hosted blog's address still needs one DNS record, and
          // that is its own step now rather than a control on the step
          // before. Every other destination goes straight into the app, as
          // it always did.
          router.push(destination === "hosted" ? CONNECT_PATH : APP_PATH);
          return;
        }
        setRefusal(answer.refused);
      } finally {
        setSaving(false);
      }
      return;
    }

    const body = stepBody();
    if (body === null) {
      // The site step with no address or no market: the same two refusals
      // the finish gives, said before the founder is carried past them.
      const checked = validateSetup(state);
      setRefusal(checked.ok ? "market_missing" : checked.because);
      return;
    }

    setSaving(true);
    try {
      const answer = await post<SetupStepResult>(body);
      if (!answer.ok) {
        if (answer.refused === "already_complete") {
          router.push(APP_PATH);
          return;
        }
        setRefusal(answer.refused);
        return;
      }
    } finally {
      setSaving(false);
    }
    setRefusal(null);
    void setStep(after);
  }

  /** Back never refuses: a founder going the other way is not answering
   *  anything, and their answers are already on screen. */
  function back(): void {
    const before = previousStep(step);
    if (before === null) return;
    setRefusal(null);
    void setStep(before);
  }

  const at = stepIndex(step);
  const pagesRead = p.model.profile?.pagesRead ?? 0;
  // Where their pages will be read: the hosted blog at
  // `<label>.<their domain>`, or their own WordPress site at the domain
  // they gave. `null` before there is an address to compose either from.
  const blogAddress =
    state.siteDomain === null
      ? null
      : destination === "wordpress" || label.trim() === ""
        ? state.siteDomain
        : `${label}.${state.siteDomain}`;

  return (
    // The page frame (owner's review of #938): at least the viewport tall,
    // with the action bar as its last row — so the bar lands on the bottom
    // of a short page and at the end of a long one, and the page can never
    // carry a blank band under it. The `Surface` above it holds the band's
    // gutter and the ruled measure; the bar sits outside it, which is what
    // lets it run edge to edge on a phone.
    <div className="grid min-h-svh grid-rows-[1fr_auto]">
      <Surface
        arms={{
          compact: { kind: "columns", count: 1 },
          medium: { kind: "columns", count: 2 },
          wide: { kind: "same-as-below" },
        }}
      >
        {/* `pb-28` is the bar's own height and a little over: the content
            scrolls *behind* a pinned bar, so the last line of it has to
            clear the bar rather than pass under it. */}
        <main
          className="grid min-w-0 grid-cols-1 content-start gap-6 p-4 pb-28"
          data-testid="setup-form"
          data-step={step}
        >
          {/* SPEC §5 (2026-09-20) and docs/DESIGN.md: a daisyUI `steps` with
              one-word labels, five equal columns at every width. */}
          <ul className="steps w-full text-xs" data-testid="setup-steps" data-current={step}>
            {SETUP_STEPS.map((id, index) => {
              const done = index < at;
              const current = index === at;
              return (
                <li
                  key={id}
                  className={done || current ? "step step-primary" : "step"}
                  data-state={done ? "done" : current ? "active" : "pending"}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? (
                    <span className="step-icon">
                      <Check {...ICON} size={16} />
                    </span>
                  ) : null}
                  {copy(STEP_LABEL[id])}
                </li>
              );
            })}
          </ul>

          {/* The question column and the panel that matches it. Below the large
              breakpoint there is one column, and the panel follows the
              question — which is what SPEC §5 asks for on a phone. */}
          {/* `grid-cols-1` rather than an implicit column: an implicit track is
              sized `minmax(auto, …)`, so one wide child's min-content would push
              the whole row past the screen. `minmax(0, 1fr)` is what makes the
              column the screen's and the content's problem to fit. */}
          {/* The calm layer (#1059, #1091): the two columns stretch to one
              height, so the panel stands as tall as the step beside it; and
              the step change rises in — the column is keyed on the step, so
              each step mounts fresh (as its own card always did) and takes
              `animate-rise` once. Reduced motion draws it in place. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              key={step}
              className="grid min-w-0 grid-cols-1 content-start gap-4 motion-safe:animate-rise"
            >
              <div className="grid gap-2">
                <h1 className="text-xl font-semibold wrap-anywhere">{copy(STEP_QUESTION[step])}</h1>
                <p className={QUIET} data-testid="setup-step-line">
                  {stepLine(step, { pagesRead, max: p.model.competitorsMax })}
                </p>
              </div>

              {step === "site" ? (
                <MarketCard
                  state={state}
                  setState={setState}
                  questions={p.model.questions}
                  resolveDomain={resolveDomain}
                />
              ) : null}

              {step === "business" ? (
                <div className="grid gap-4" data-testid="setup-pages-read">
                  <p className={QUIET}>{copy("setup.business.pages-read")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* #970: the confirmed profile's own counts — the same
                        `purposeCounts` over the same inventory, read once
                        where Settings reads it. */}
                    {p.model.business.purposes.map((entry) => (
                      <span key={entry.purpose} className="badge badge-ghost gap-2">
                        <span data-testid={`setup-profile-purpose-${entry.purpose}`}>
                          {copy(PURPOSE_COPY[entry.purpose])}
                        </span>
                        <span className="num">{entry.count}</span>
                      </span>
                    ))}
                  </div>
                  <p className={QUIET} data-testid="setup-business-assurance">
                    {copy("setup.business.assurance")}
                  </p>
                </div>
              ) : null}

              {step === "rivals" ? (
                <RivalsCard
                  rivals={state.rivals}
                  suggestions={state.suggestions}
                  ownDomain={state.siteDomain}
                  max={p.model.competitorsMax}
                  resolveDomain={resolveDomain}
                  onRivals={(rivals) => setState((current) => ({ ...current, rivals }))}
                />
              ) : null}

              {step === "voice" ? (
                <VoiceCard profile={p.model.profile} voice={voiceDraft} onVoice={setVoiceDraft} />
              ) : null}

              {step === "publishing" ? (
                <PublishingCard
                  cards={p.model.cards}
                  siteDomain={state.siteDomain}
                  cnameTarget={p.model.cnameTarget}
                  destination={destination}
                  onDestination={setDestination}
                  label={label}
                  onLabel={setLabel}
                />
              ) : null}
            </div>

            {/* On the business step the panel *is* the step's own controls, so
                it is rendered there rather than beside a second copy. */}
            <SetupPanel
              market={settledCategory(state)}
              rivalGrid={p.model.rivalGrid}
              status={
                <PassStatusLine
                  stage={p.model.passStage}
                  channel={p.model.passChannel}
                />
              }
              step={step}
              blogAddress={blogAddress}
              businessName={p.model.profile?.siteName ?? null}
              draft={business}
              onDraft={setBusiness}
              job={job}
              onJob={setJob}
            />
          </div>

          {refusal === null ? null : (
            <div
              role="alert"
              className="alert alert-error alert-soft text-sm"
              data-testid="setup-submit-refusal"
            >
              {copy(REFUSAL_COPY[refusal])}
            </div>
          )}
        </main>
      </Surface>

      {/* SPEC §5 (2026-09-20): on a phone the actions are pinned to the
          bottom. Edge to edge, solid, with one hairline over it — a strip
          inset from both edges reads as floating, and the customer's own
          page shows past it (owner's review of #938). The outer padding is
          the band's own gutter plus `main`'s, so Back and the primary stand
          exactly under the question they belong to, and the inner box is
          the ruled measure — all without this row sitting inside the
          `Surface`, which would inset its background with it. */}
      {/* A `<footer>`, not a `<div>` (#328): this row stands outside the
          `Surface`'s `<main>` — deliberately, for the background above —
          so as a `<div>` it was screen content belonging to no landmark at
          all (`region`, on all five steps). It is the screen's footer in
          every sense: the step's two controls and the standing line under
          them. The element changes; nothing it draws does. */}
      <footer className="sticky bottom-0 border-t border-base-300 bg-base-100 px-8 lg:px-10 xl:px-12">
        <div className="mx-auto grid w-full max-w-(--w-wide) gap-3 py-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={at === 0 || saving}
              onClick={back}
            >
              <ArrowLeft {...ICON} size={20} />
              {copy("setup.back")}
            </button>
            {/* The screen's one solid primary. */}
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              aria-busy={saving}
              data-testid="setup-onwards"
              onClick={() => void onwards()}
            >
              {copy(onwardsLabel(step))}
            </button>
          </div>
          {/* REQ-021 c10 — said once, under the controls it is about. */}
          <p className={`text-center ${QUIET}`} data-testid="setup-footer-line">
            {copy("setup.footer.line")}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** The line under the question. Two of the five take a number the screen
 *  read rather than a number it chose. */
function stepLine(step: SetupStepId, a: { pagesRead: number; max: number }): string {
  if (step === "business") {
    return a.pagesRead === 0
      ? copy("setup.step.business.line.unread")
      : copy("setup.step.business.line", { pages: String(a.pagesRead) });
  }
  if (step === "rivals") return copy("setup.step.rivals.line", { max: String(a.max) });
  if (step === "site") return copy("setup.step.site.line");
  if (step === "voice") return copy("setup.step.voice.line");
  return copy("setup.step.publishing.line");
}

/** What the one primary reads. "That’s us" is the business step's own
 *  (issue #922); the last step finishes. */
function onwardsLabel(step: SetupStepId): CopyKey {
  if (step === "business") return "setup.business.confirm";
  return isLastStep(step) ? "setup.finish" : "setup.continue";
}

/** The label the hosted card was composed with — the founder's own, or the
 *  default they have not changed. Read off the card rather than named again
 *  here, so "the value they were shown" and "the value the field opens on"
 *  are one fact (SPEC §5). */
function hostedLabel(model: SetupScreenModel): string {
  const hosted = model.cards.destination.find((option) => option.kind === "hosted");
  if (hosted?.label === undefined) {
    throw new Error("SetupForm: the hosted destination must always carry a subdomain label.");
  }
  return hosted.label;
}
