// SPEC §5 — the rivals step of `/setup`: pre-filled suggestions, removable,
// add their own, at most five. daisyUI classes in the route (DESIGN.md
// rule 1): `card`, `badge`, `btn`, `input`, `alert`; lucide glyphs at 1.75.
//
// The rules are `@/lib/market/setup/rivals`'s — what a refusal is called,
// when the set is full. This card holds the text being typed and the one
// refusal on show, and hands the set it settles on back to the form, whose
// one submit stores it.
"use client";

import type React from "react";
import { useId, useState, type KeyboardEvent } from "react";
import { Plus, Users, X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import {
  addRival,
  isFull,
  removeRival,
  type RivalRefusal,
  type RivalSet,
} from "@/lib/market/setup/rivals";
import type { SetupState } from "@/lib/market/setup/state";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";

const REFUSAL_COPY = {
  not_a_domain: "setup.competitors.refused.not-a-domain",
  does_not_resolve: "setup.competitors.refused.does-not-resolve",
  own_domain: "setup.competitors.refused.own-domain",
  already_present: "setup.competitors.refused.already-present",
  set_full: "setup.competitors.refused.set-full",
} as const satisfies Record<RivalRefusal, CopyKey>;

/** REQ-026 c10: what the card says while there is nothing to offer. */
const SUGGESTION_STATUS = {
  awaiting_market: { key: "setup.competitors.awaiting-market", testId: "setup-competitors-awaiting" },
  seeking: { key: "setup.competitors.seeking", testId: "setup-competitors-seeking" },
  none_found: { key: "setup.competitors.none-found", testId: "setup-competitors-none-found" },
} as const satisfies Record<
  Exclude<SetupState["suggestions"]["state"], "offered">,
  { key: CopyKey; testId: string }
>;

/** The field asks for the first rival by example and for the next by
 *  "another". */
const ADD_PLACEHOLDER = {
  first: "setup.competitors.add.placeholder.first",
  another: "setup.competitors.add.placeholder",
} as const satisfies Record<string, CopyKey>;

const TEST_ID = "setup-competitors";
const ICON = { strokeWidth: 1.75 } as const;

export function RivalsCard(p: {
  rivals: RivalSet;
  suggestions: SetupState["suggestions"];
  ownDomain: string | null;
  max: number;
  resolveDomain: (host: string) => Promise<ResolveDomainResponse>;
  onRivals: (next: RivalSet) => void;
}): React.JSX.Element {
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [refusal, setRefusal] = useState<RivalRefusal | null>(null);

  const chosen = new Set(p.rivals.map((rival) => rival.domain));
  const full = isFull(p.rivals);
  // SPEC §5: a sixth rival is refused with the limit named. A full set
  // disables the field, so the refusal is said up front rather than after
  // a click that cannot happen.
  const shown: RivalRefusal | null = refusal ?? (full ? "set_full" : null);
  const status =
    p.suggestions.state === "offered" ? null : SUGGESTION_STATUS[p.suggestions.state];

  function remove(domain: string): void {
    setRefusal(null);
    p.onRivals(removeRival(p.rivals, domain));
  }

  function toggleSuggested(domain: string): void {
    if (chosen.has(domain)) {
      remove(domain);
      return;
    }
    // A suggestion came from the product's own derivation over the
    // founder's market: it is canonical and it resolves by provenance.
    settle(
      addRival(p.rivals, {
        domain,
        origin: "suggested",
        ownDomain: p.ownDomain,
        resolves: true,
      }),
    );
  }

  async function addTyped(): Promise<void> {
    if (draft.trim() === "") return;
    const answer = await p.resolveDomain(draft);
    if (settle(
      addRival(p.rivals, {
        domain: answer.domain,
        origin: "typed",
        ownDomain: p.ownDomain,
        resolves: answer.resolves,
      }),
    )) {
      setDraft("");
    }
  }

  function settle(result: ReturnType<typeof addRival>): boolean {
    if (!result.ok) {
      setRefusal(result.because);
      return false;
    }
    setRefusal(null);
    p.onRivals(result.set);
    return true;
  }

  /** Enter adds the rival; it must not submit the whole setup. */
  function onFieldKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void addTyped();
  }

  return (
    <section className="card bg-base-100 shadow-sm" data-testid={TEST_ID}>
      <div className="card-body gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title text-base">
            <Users aria-hidden size={20} {...ICON} />
            {copy("setup.competitors.title")}
          </h2>
          <span className="badge badge-ghost num" data-testid="setup-competitors-limit">
            {copy("setup.competitors.limit", { chosen: p.rivals.length, max: p.max })}
          </span>
        </div>

        {status === null ? null : (
          <p className="text-sm text-base-content/70" data-testid={status.testId}>
            {copy(status.key)}
          </p>
        )}

        {p.suggestions.candidates.length === 0 ? null : (
          <div className="flex flex-wrap gap-2" data-testid="setup-competitors-suggested">
            {p.suggestions.candidates.map((domain) => (
              <button
                key={domain}
                type="button"
                className={`btn btn-sm btn-outline num ${chosen.has(domain) ? "btn-active" : ""}`}
                aria-pressed={chosen.has(domain)}
                disabled={full && !chosen.has(domain)}
                onClick={() => toggleSuggested(domain)}
              >
                {domain}
              </button>
            ))}
          </div>
        )}

        {p.rivals.length === 0 ? null : (
          <ul className="flex flex-wrap gap-2" data-testid="setup-competitors-selected">
            {p.rivals.map((rival) => (
              <li key={rival.domain} className="badge badge-primary badge-soft badge-lg num gap-1 pr-1">
                {rival.domain}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle"
                  aria-label={copy("setup.competitors.remove", { rival: rival.domain })}
                  onClick={() => remove(rival.domain)}
                >
                  <X aria-hidden size={16} {...ICON} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-base-content/70" htmlFor={fieldId}>
            {copy("setup.competitors.add.label")}
          </label>
          <div className="flex gap-2">
            <input
              id={fieldId}
              type="text"
              name="competitor"
              className={`input num w-full ${refusal === null ? "" : "input-error"}`}
              placeholder={copy(ADD_PLACEHOLDER[p.rivals.length === 0 ? "first" : "another"])}
              value={draft}
              disabled={full}
              aria-invalid={refusal !== null}
              onChange={(event) => {
                setDraft(event.target.value);
                setRefusal(null);
              }}
              onKeyDown={onFieldKey}
            />
            <button
              type="button"
              className="btn btn-outline"
              disabled={full}
              onClick={() => {
                void addTyped();
              }}
            >
              <Plus aria-hidden size={20} {...ICON} />
              {copy("setup.competitors.add.action")}
            </button>
          </div>
        </div>

        {shown === null ? null : (
          <div
            role="alert"
            className={`alert alert-soft text-sm ${refusal === null ? "alert-warning" : "alert-error"}`}
            data-testid="setup-competitors-refusal"
          >
            {copy(REFUSAL_COPY[shown])}
          </div>
        )}
      </div>
    </section>
  );
}
