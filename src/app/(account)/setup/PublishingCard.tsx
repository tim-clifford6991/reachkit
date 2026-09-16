// SPEC §5 — the publishing step of `/setup`: where pages publish — the
// hosted subdomain label they choose (default), or WordPress connected
// later. No mode pair: Autopilot is the only mode (SPEC §7, #476). daisyUI
// classes in the route (DESIGN.md rule 1): `card`, `badge`, `input`,
// `alert`; lucide glyphs at 1.75. No option is a solid primary: the
// screen's one primary is the submit.
//
// The destination and the label are the form's, because the one
// submit stores them. This card holds whether the label is refused, and
// asks the server whether anyone else already serves at it.
//
// **The record can be verified here, before submit** (owner ruling
// 2026-09-16, #757). The "check connection" press sits under the label —
// the record is inside the hosted option's button, and a button nested in
// a button is neither valid markup nor operable — and what it learns is
// drawn on the record's own badge. The host it asks about is the server's
// to derive from the site's own address; this card sends the label and the
// address on screen, and nothing else.
"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import { Circle, CircleCheck, Sparkles } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import {
  dnsRecordFor,
  type DestinationKind,
  type DnsPending,
  type DnsRecord,
  type SetupCards,
} from "@/lib/publish/setup/cards";
import { checkLabel, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import { checkSubdomainLabel } from "./label-actions";
import { CnameRecord } from "../_destination/CnameRecord";
import { CheckConnection } from "../_destination/CheckConnection";
import type { ConnectionCheck } from "../_destination/check-actions";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";

/** SPEC §5's two refusals, the same two keys the submit's own resolve to. */
const LABEL_REFUSAL_COPY = {
  not_a_label: "setup.destination.label.refused.invalid",
  taken: "setup.destination.label.refused.taken",
} as const satisfies Record<LabelRefusal, string>;

const TEST_ID = "setup-publishing";
const QUIET = "block text-sm text-base-content/70";

export function PublishingCard(p: {
  cards: SetupCards;
  siteDomain: string | null;
  cnameTarget: string;
  destination: DestinationKind;
  onDestination: (destination: DestinationKind) => void;
  label: string;
  onLabel: (label: string) => void;
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

  // What the last press learned, for the record it was asked about. A
  // record whose name has since moved — a new label, a new address — was
  // never asked about, and reads as waiting again.
  const [checked, setChecked] = useState<{ name: string; state: HostnameState } | null>(null);
  const recordName = "pending" in dns ? null : dns.name;
  const recordState = checked !== null && checked.name === recordName ? checked.state : undefined;
  function onAnswer(name: string, answer: ConnectionCheck): void {
    if (answer.outcome === "asked") setChecked({ name, state: answer.state });
    else if (answer.outcome !== "too_soon") setChecked(null);
  }

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
    // A check that does not complete refuses nothing: the submit asks the
    // same question against the canonical domain and decides.
    let answer: LabelRefusal | null = null;
    try {
      answer = (await checkSubdomainLabel({ label: next, domain: p.siteDomain })).refusal;
    } catch {
      answer = null;
    }
    if (mine === asked.current) setRefusal(answer);
  }

  return (
    <section className="card bg-base-100 shadow-sm" data-testid={TEST_ID}>
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <Sparkles aria-hidden size={20} strokeWidth={1.75} />
          {copy("settings.publishing.title")}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2" data-testid="setup-destination">
          {p.cards.destination.map((option) => (
            <Option
              key={option.kind}
              title={copy(option.name)}
              line={copy(option.copy)}
              chosen={p.destination === option.kind}
              preselected={option.preselected}
              onChoose={() => p.onDestination(option.kind)}
              testId={`setup-destination-${option.kind}`}
            >
              {option.kind === "hosted" ? <HostedRecord dns={dns} state={recordState} /> : null}
              {option.kind === "wordpress" ? <WordPressAsks domain={p.siteDomain} /> : null}
            </Option>
          ))}
        </div>

        {/* The label sits under the pair, not inside the hosted option:
            that option is a button, and a field nested in a button is
            neither valid markup nor operable by keyboard. */}
        {p.destination === "hosted" ? (
          <div className="flex flex-col gap-1.5" data-testid="setup-destination-label">
            <label className="text-sm text-base-content/70" htmlFor={labelId}>
              {copy("setup.destination.label.label")}
            </label>
            <input
              id={labelId}
              type="text"
              name="label"
              className={`input num w-full ${refusal === null ? "" : "input-error"}`}
              value={p.label}
              aria-invalid={refusal !== null}
              onChange={(event) => {
                void draftLabel(event.target.value);
              }}
            />
            {refusal === null ? null : (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                {copy(LABEL_REFUSAL_COPY[refusal])}
              </div>
            )}
            {/* Keyed by the record's name: a press answers for one host,
                and a moved label starts from nothing asked. No press
                before there is a record to verify. */}
            {recordName === null ? null : (
              <CheckConnection
                key={recordName}
                draft={{ label: p.label, domain: p.siteDomain }}
                onAnswer={(answer) => onAnswer(recordName, answer)}
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** One choice of a pair: a bordered card that is a toggle button. Chosen
 *  is the primary edge and tint plus `aria-pressed` — never the solid
 *  primary, which is the submit's. */
function Option(p: {
  title: string;
  line: string;
  chosen: boolean;
  preselected: boolean;
  onChoose: () => void;
  testId: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  const Mark = p.chosen ? CircleCheck : Circle;
  return (
    <button
      type="button"
      className={`card card-border text-left transition-colors ${
        p.chosen ? "border-primary bg-primary/5" : "hover:border-base-content/30"
      }`}
      aria-pressed={p.chosen}
      onClick={p.onChoose}
      data-testid={p.testId}
    >
      <span className="card-body gap-1 p-4">
        <span className="flex items-center gap-2 font-medium">
          <Mark
            aria-hidden
            size={20}
            strokeWidth={1.75}
            className={p.chosen ? "text-primary" : "text-base-content/40"}
          />
          {p.title}
          {p.preselected ? (
            <span className="badge badge-sm badge-primary badge-soft" data-testid="setup-option-default">
              {copy("setup.mode.default")}
            </span>
          ) : null}
        </span>
        <span className={QUIET} data-testid="setup-option-line">
          {p.line}
        </span>
        {p.children}
      </span>
    </button>
  );
}

/** REQ-028 c2: the record once the site address is known, one written line
 *  where it is not — never a blank. Spans only: it sits inside a button. */
function HostedRecord(p: { dns: DnsRecord | DnsPending; state: HostnameState | undefined }): React.JSX.Element {
  if ("pending" in p.dns) {
    return (
      <span className={`mt-2 ${QUIET}`} data-testid="setup-dns-pending">
        {copy(p.dns.copy)}
      </span>
    );
  }
  // The same block Settings shows a destination still waiting for DNS (#754).
  return <CnameRecord record={p.dns} {...(p.state === undefined ? {} : { state: p.state })} />;
}

/** What connecting WordPress will ask for, shown on the option that offers
 *  it. Shown, never asked here: SPEC §5 keeps the connect for later. */
function WordPressAsks(p: { domain: string | null }): React.JSX.Element {
  return (
    <>
      <span className="mt-2 flex min-w-0 flex-col">
        <span className={QUIET}>{copy("settings.destination.site-url")}</span>
        {p.domain === null ? null : (
          <span className="num text-sm wrap-anywhere" data-testid="setup-wordpress-site">
            {p.domain}
          </span>
        )}
      </span>
      <span className="mt-2 flex min-w-0 flex-col">
        <span className={QUIET}>{copy("settings.destination.app-password")}</span>
        <span className="text-sm" data-testid="setup-wordpress-help">
          {copy("settings.destination.app-password.help")}
        </span>
      </span>
    </>
  );
}
