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
// **The record is not here any more** (owner, 2026-09-20, #924, reversing
// #757). It was completed and verified on this step; it is its own step
// after setup now — `/setup/connect` — with *Do this later*, and it stays
// reachable from Overview's needs-you and from Settings until the host is
// live. What is left on this step is the one decision it is for: where
// pages publish, and under what label. A founder who never opens the
// connect step still finishes setup, and their pages are still written and
// wait in review (2026-09-16).
"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import { Circle, CircleDot, Globe, Layers, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import {
  dnsRecordFor,
  type DestinationKind,
  type DnsPending,
  type SetupCards,
} from "@/lib/publish/setup/cards";
import { checkLabel, type LabelRefusal } from "@/lib/publish/destinations/hosted/label";
import { checkSubdomainLabel } from "./label-actions";

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

  const host = p.siteDomain === null || p.label.trim() === "" ? null : `${p.label}.${p.siteDomain}`;

  return (
    <section className="grid min-w-0 gap-6" data-testid={TEST_ID}>
      <div className="grid min-w-0 gap-3">
        <h2 className="text-(length:--t-body) font-bold">{copy("setup.destination.where")}</h2>
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
            >
              {option.kind === "hosted" && "pending" in dns ? <DnsPendingLine dns={dns} /> : null}
            </Option>
          ))}
        </div>
      </div>

      {/* The box under the pair follows the choice, as board Setup's note draws it. The label is
          here, not inside the hosted option: that option is a button, and a field nested in a
          button is neither valid markup nor operable by keyboard. */}
      {p.destination === "hosted" ? (
        <div className={BOX} data-testid="setup-destination-label">
          <div className="card-body gap-1.5 p-5">
            <label className="text-sm font-semibold" htmlFor={labelId}>
              {copy("setup.destination.label.label")}
            </label>
            <input
              id={labelId}
              type="text"
              name="label"
              className={`input num h-11 w-full ${refusal === null ? "" : "input-error"}`}
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
            {/* The record and its check are `/setup/connect`'s (#924); this line says connecting comes next. */}
            {"pending" in dns ? null : (
              <p className={`mt-2 ${QUIET}`} data-testid="setup-dns-next">
                {copy("setup.destination.connect-next")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <WordPressAsks domain={p.siteDomain} />
      )}
    </section>
  );
}

/** One choice of a pair: a bordered card that is a toggle button. Chosen
 *  is the primary edge and tint plus `aria-pressed` — never the solid
 *  primary, which is the submit's. */
function Option(p: {
  icon: LucideIcon;
  title: string;
  line: string;
  /** A value under the title: the address the hosted option would serve. */
  detail: string | null;
  chosen: boolean;
  onChoose: () => void;
  testId: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  const Mark = p.chosen ? CircleDot : Circle;
  return (
    <button
      type="button"
      className={`flex min-w-0 items-start gap-3 rounded-box border p-4 text-left transition-colors ${
        p.chosen ? "border-primary bg-(--accent-bg)" : "border-base-300 bg-base-100 hover:border-base-content/30"
      }`}
      aria-pressed={p.chosen}
      onClick={p.onChoose}
      data-testid={p.testId}
    >
      <Mark
        aria-hidden
        size={20}
        strokeWidth={1.75}
        className={`mt-0.5 shrink-0 ${p.chosen ? "text-primary" : "text-base-content/40"}`}
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
        {p.children}
      </span>
    </button>
  );
}

/** REQ-028 c2: one written line where the record will sit until the site
 *  address is known — never a blank. A span: it sits inside a button. */
function DnsPendingLine(p: { dns: DnsPending }): React.JSX.Element {
  return (
    <span className={`mt-2 ${QUIET}`} data-testid="setup-dns-pending">
      {copy(p.dns.copy)}
    </span>
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
