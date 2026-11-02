// SPEC §5 — setup's Connect step, as board Setup draws it on one screen:
// where pages live, then for the hosted address the record to paste (its
// Name row is the label the founder chooses), doing it later and the week
// after; for WordPress, what connecting it will ask for. No mode pair:
// Autopilot is the only mode (SPEC §7, #476). The record no longer waits for
// a screen of its own after setup (#2270, superseding #924's separate step);
// `/setup/connect` stays the way back to it from Overview and Settings.
//
// The destination and the label are the form's, because the step's save
// stores them. This card holds whether the label is refused, and asks the
// server whether anyone else already serves at it.
"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import { Globe, Layers, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import {
  dnsRecordFor,
  type DestinationKind,
  type DnsPending,
  type SetupCards,
} from "@/lib/publish/setup/cards";
import { checkLabel, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { checkSubdomainLabel } from "./label-actions";
import { DnsCard, Later, WeekCard } from "./connect/parts";

/** SPEC §5's two refusals, the same two keys the submit's own resolve to. */
const LABEL_REFUSAL_COPY = {
  not_a_label: "setup.destination.label.refused.invalid",
  taken: "setup.destination.label.refused.taken",
} as const satisfies Record<LabelRefusal, string>;

const TEST_ID = "setup-publishing";
const QUIET = "block text-(length:--t-sm) text-base-content/70";
const BOX = "card border border-base-300 bg-base-100 shadow-(--shadow-card)";
const TILE = "grid shrink-0 place-items-center rounded-box";

/** Board Setup's mark for each place pages can live. */
const DESTINATION_ICON = { hosted: Globe, wordpress: Layers } as const satisfies Record<DestinationKind, LucideIcon>;

export function PublishingCard(p: {
  cards: SetupCards;
  siteDomain: string | null;
  cnameTarget: string;
  destination: DestinationKind;
  onDestination: (destination: DestinationKind) => void;
  label: string;
  onLabel: (label: string) => void;
  /** Doing it later: the caller saves the step and leaves for the app. */
  onLater: () => void;
  /** Whether the step is saving, so doing it later cannot be pressed twice. */
  busy: boolean;
  /** What the founder's last check said of the host; `undefined` is "not asked". */
  connection?: HostnameState;
}): React.JSX.Element {
  const labelId = useId();
  const [refusal, setRefusal] = useState<LabelRefusal | null>(null);
  /** Which availability question is current: a founder types faster than
   *  a round trip answers, and an older answer must not refuse a newer
   *  label. */
  const asked = useRef(0);

  // The record's name moves with the address and the label, so it is
  // composed here; the target is the deployment's binding.
  const dns = dnsRecordFor({ siteDomain: p.siteDomain, cnameTarget: p.cnameTarget, label: p.label });

  async function draftLabel(next: string): Promise<void> {
    p.onLabel(next);
    const shape = checkLabel(next);
    if (!shape.ok) {
      setRefusal(shape.because);
      return;
    }
    setRefusal(null);
    asked.current += 1;
    const mine = asked.current;
    // A check that does not complete refuses nothing: the save asks the
    // same question against the canonical domain and decides.
    let answer: LabelRefusal | null = null;
    try {
      answer = (await checkSubdomainLabel({ label: next, domain: p.siteDomain })).refusal;
    } catch {
      answer = null;
    }
    if (mine === asked.current) setRefusal(answer);
  }

  const host = p.siteDomain === null || p.label.trim() === "" ? null : `${p.label}.${p.siteDomain}`;
  // The record names `<label>.<domain>`, so a blank label draws the record with no name yet.
  const record = "pending" in dns ? null : dns;

  return (
    <section className="grid min-w-0 gap-6" data-testid={TEST_ID}>
      <fieldset className="grid min-w-0 gap-3">
        <legend className="pb-3 text-(length:--t-body) font-bold">{copy("setup.destination.where")}</legend>
        <div className="grid gap-3" data-testid="setup-destination">
          {p.cards.destination.map((option) => (
            <Option
              key={option.kind}
              icon={DESTINATION_ICON[option.kind]}
              title={copy(option.name)}
              line={copy(option.copy)}
              detail={option.kind === "hosted" ? host : null}
              chosen={p.destination === option.kind}
              onChoose={() => p.onDestination(option.kind)}
              testId={`setup-destination-${option.kind}`}
            />
          ))}
        </div>
      </fieldset>

      {p.destination === "wordpress" ? (
        <WordPressAsks domain={p.siteDomain} />
      ) : record === null ? (
        "pending" in dns ? <DnsPendingLine dns={dns} /> : null
      ) : (
        <>
          <DnsCard
            record={record}
            {...(p.connection === undefined ? {} : { state: p.connection })}
            name={
              <span className="grid min-w-0 grow gap-1" data-testid="setup-destination-label">
                <input
                  id={labelId}
                  type="text"
                  name="label"
                  aria-label={copy("setup.destination.label.label")}
                  className={`input num input-sm h-11 w-full ${refusal === null ? "" : "input-error"}`}
                  value={p.label}
                  aria-invalid={refusal !== null}
                  onChange={(event) => {
                    void draftLabel(event.target.value);
                  }}
                />
                {refusal === null ? null : (
                  <span role="alert" className="text-(length:--t-sm) text-error">
                    {copy(LABEL_REFUSAL_COPY[refusal])}
                  </span>
                )}
              </span>
            }
          />
          <Later live={p.connection === "live"} onLater={p.onLater} busy={p.busy} />
        </>
      )}

      <WeekCard />
    </section>
  );
}

/** One choice of a pair: a bordered row with daisyUI's radio. Chosen is the primary edge and tint. */
function Option(p: {
  icon: LucideIcon;
  title: string;
  line: string;
  /** A value under the title: the address the hosted option would serve. */
  detail: string | null;
  chosen: boolean;
  onChoose: () => void;
  testId: string;
}): React.JSX.Element {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-box border p-4 transition-colors ${
        p.chosen ? "border-primary bg-(--accent-bg)" : "border-base-300 bg-base-100 hover:border-base-content/30"
      }`}
      data-testid={p.testId}
    >
      <input
        type="radio"
        name={RADIO_NAME}
        className="radio radio-primary radio-sm mt-0.5 shrink-0"
        checked={p.chosen}
        onChange={p.onChoose}
      />
      <span className={`${TILE} size-8 bg-(--accent-bg) text-primary`} aria-hidden>
        <p.icon size={16} strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col">
        <strong className="text-(length:--t-body)">{p.title}</strong>
        {p.detail === null ? null : <span className="num text-(length:--t-sm) wrap-anywhere">{p.detail}</span>}
        <span className={QUIET} data-testid="setup-option-line">
          {p.line}
        </span>
      </span>
    </label>
  );
}

/** The radios' group name: a form handle, not a sentence. */
const RADIO_NAME = "destination";

/** REQ-028 c2: one written line where the record will sit until the site
 *  address is known — never a blank. */
function DnsPendingLine(p: { dns: DnsPending }): React.JSX.Element {
  return (
    <p className={QUIET} data-testid="setup-dns-pending">
      {copy(p.dns.copy)}
    </p>
  );
}

/** What connecting WordPress will ask for, in the box under the pair. Shown, never asked
 *  here: SPEC §5 keeps the connect for later, in Settings › Publishing. */
function WordPressAsks(p: { domain: string | null }): React.JSX.Element {
  return (
    <div className={BOX} data-testid="setup-wordpress-asks">
      <div className="card-body gap-3 p-5">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{copy("settings.destination.site-url")}</span>
          {p.domain === null ? null : (
            <span className="num text-sm wrap-anywhere" data-testid="setup-wordpress-site">
              {p.domain}
            </span>
          )}
        </span>
        <span className="text-sm font-semibold">{copy("settings.destination.username")}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{copy("settings.destination.app-password")}</span>
          <span className={QUIET} data-testid="setup-wordpress-help">
            {copy("settings.destination.app-password.help")}
          </span>
        </span>
      </div>
    </div>
  );
}
