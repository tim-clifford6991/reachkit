// BUILD §4.7 — "**Competitors** (chips ×5, add/remove)".
//
// One settable key, `competitors`, and the whole of what §4.7 asks of it: the
// set as chips, a remove beside each, and a way to add. `COMPETITORS_MAX` is
// five (§6.1) and is a pinned engine constant — it bounds the set, it is not a
// number this screen offers anyone to change, and the add control is simply
// absent once the set is full rather than present-and-refusing.
//
// The set is the customer's own answer, not a derivation: §6.6 rules that
// "the customer can always type a rival manually — a cold-start founder knows
// their competitors even when no dataset does". Suggestions from the market
// (`deriveRivals`) are a setup-time offer (issue #37), not a settings-screen
// list, so none is rendered here.
//
// Each card states its figures from the Competitors tab's own readers
// (`../market-figures.ts`), and one that joined after the last scan says when
// it is measured from rather than drawing a zero.
//
// Cold start (§6.6): an empty set renders the add control and no chips —
// and, since issue #204, REQ-071 c16's one line where the chips would be.
//
// **That reverses this file's earlier reading, on the criterion's own
// words.** It said no empty-state sentence was owed, because a customer
// looking at an add control is looking at the one thing there is to do.
// c16 is about a different fact: not what the customer may do next, but
// what the *product* will not do until they do it — there is no rival
// comparison to make, so none is made. A control cannot say that, and §2.5
// requires an empty state to be designed rather than blank.
//
// **Add and remove write, since issue #231.** Both go through
// `../change-actions.ts` and therefore through `addRival` / `removeRival`
// and `saveRivals` — REQ-071 c4's "the same rules" as setup, applied on the
// server against the stored set. This card sends one typed domain and one
// pressed chip; it never sends the set. A set from the browser is a set a
// browser can rewrite, and it is also a stale one, which is how a fifth
// rival gets added to a set that already holds five.
//
// **The refusal belongs to the field, not to the chips.** Every one of
// `addRival`'s five is about the value that was typed, so it is shown on
// the field that holds it, with the value intact.
//
// **The field has its own name, since issue #270.** It was labelled with
// the card's heading key, so the card read "Competitors … Competitors": a
// heading naming the set and a field under it repeating the word rather
// than naming what is typed into it. `settings.competitors.add-label` is
// the field's label and nothing else — no placeholder repeating it (ADR-093's
// "one string, once"). The heading key is read once, by the heading.
"use client";

import type React from "react";
import Link from "next/link";
import { Sparkles, User, Users, X } from "lucide-react";
import { useState, useTransition } from "react";
import { copy } from "@/lib/presentation/copy";
import { ANSWER_RATE_WEEKS, BATTERY } from "@/lib/config/constants";
import { writtenLine } from "../../_shell/written";
import { TAB_HREF } from "../../_overview/tabs";
import { addRivalAction, removeRivalAction } from "../change-actions";
import {
  MARKET_CHANGE_INITIAL,
  RIVAL_FIELD,
  refusalKeyOf,
  type MarketChangeState,
} from "../market-state";
import type { Half, MarketFigures } from "../market-figures";
import type { SettingsModel } from "../model";

/** c16's line, or nothing while the owner has not written it — never a
 *  placeholder standing where a sentence belongs (REQ-091 c2). */
function EmptyLine(): React.JSX.Element | null {
  const line = writtenLine("settings.competitors.none-yet");
  return line === null ? null : (
    <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="competitors-none-yet-line">
      {line}
    </p>
  );
}

// The board draws a rival as two letters: a hyphenated name's word initials, else its first two letters.
const rivalInitials = (domain: string): string => {
  const words = domain.replace(/^www\./i, "").split(".")[0]!.split(/[-_]+/).filter(Boolean);
  return (words.length > 1 ? words[0]!.charAt(0) + words[1]!.charAt(0) : (words[0] ?? domain).slice(0, 2)).toUpperCase();
};

function Avatar(p: { domain: string; you?: boolean }): React.JSX.Element {
  return (
    <span className="avatar avatar-placeholder" aria-hidden>
      <span className={`${p.you ? "w-7 bg-primary text-primary-content" : "w-10 bg-base-200"} rounded-field font-semibold`}>
        {p.you ? p.domain.charAt(0).toUpperCase() : rivalInitials(p.domain)}
      </span>
    </span>
  );
}

/** One figure line: its label, `n of m` and a bar, or what stands in for an unread half. */
function FigureLine(p: { label: string; half: Half; pending: string | null; testId: string }): React.JSX.Element {
  const value =
    p.pending ?? (p.half === null ? copy("settings.competitors.not-measured") : copy("settings.competitors.figure", { n: String(p.half.n), of: String(p.half.of) }));
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid={p.testId}>
      <span className="flex min-w-0 flex-wrap justify-between gap-2">
        <span className="text-base-content/70">{p.label}</span>
        <strong className="num">{value}</strong>
      </span>
      {p.pending !== null || p.half === null ? null : (
        <progress className="progress w-full" value={p.half.n} max={p.half.of} aria-hidden />
      )}
    </div>
  );
}

/** The set, its figures and the add field: a client panel takes what it renders. */
export function CompetitorsPanel(p: {
  competitors: SettingsModel["competitors"];
  /** D28 (#1185): ReachKit's conclusion, for each rival's one line. */
  concluded?: SettingsModel["concluded"];
  figures: MarketFigures;
  /** When a competitor added now is first measured, written in the site's zone. */
  measuredFrom: string;
  ownDomain: string;
  /** Far larger competitors, kept apart from the comparison (issue 858). */
  leaders: readonly string[];
  /** The footnote's facts; `null` where that half was not read. */
  detail: { googleOn: string | null; searches: number | null; questions: number | null };
}): React.JSX.Element {
  const concluded = p.concluded ?? null;
  const reasons = concluded === null || concluded.rivalsOverridden ? null : concluded.reasons;
  const more = BATTERY.COMPETITORS_MAX - p.competitors.length;
  // The typed domain, kept across a refusal, and the answer the last press
  // gave. Neither is a copy of the set: the set is the model's, re-read
  // after every save, and this card holds no second one to fall out of
  // step with it.
  const [value, setValue] = useState("");
  const [answer, setAnswer] = useState<MarketChangeState>(MARKET_CHANGE_INITIAL);
  // Issue 1196: one press at a time, and the pressed control spins.
  const [busy, startWriting] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  async function add(form: FormData): Promise<void> {
    const next = await addRivalAction(form);
    setAnswer(next);
    // A rival that went in is no longer a value being typed; a refused one
    // stays in the field with the reason beside it.
    setValue(next.answer === "refused" ? next.value : "");
  }

  async function remove(form: FormData): Promise<void> {
    // `removeRival` cannot refuse: the card is gone from the next read.
    setAnswer(await removeRivalAction(form));
  }

  const refusal = refusalKeyOf(answer);
  const refusalLine = refusal === null ? null : writtenLine(refusal);
  const pending = copy("settings.competitors.measured-from", { date: p.measuredFrom });
  const you = p.figures.you;
  const detail = [
    p.detail.googleOn === null || p.detail.searches === null
      ? null
      : copy("settings.competitors.detail.google", { date: p.detail.googleOn, n: String(p.detail.searches) }),
    p.detail.questions === null
      ? null
      : copy("settings.competitors.detail.ai", { weeks: String(ANSWER_RATE_WEEKS), n: String(p.detail.questions) }),
  ].filter((line): line is string => line !== null);

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
            <h2 className="card-title text-base">{copy("settings.competitors.title")}</h2>
            {concluded === null ? null : (
              <p className="text-sm text-base-content/70 wrap-anywhere" data-testid="competitors-concluded">
                {copy(concluded.rivalsOverridden ? "settings.competitors.overridden" : "settings.competitors.concluded")}
              </p>
            )}
          </div>
          <span className="num text-sm text-base-content/70" data-testid="competitor-count">
            {copy("settings.competitors.count", {
              taken: String(p.competitors.length),
              max: String(BATTERY.COMPETITORS_MAX),
            })}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-4" data-testid="setting-competitors">
          {p.competitors.length > 0 ? null : <EmptyLine />}
          <ul className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3" data-layout="tiles">
            {p.competitors.map((domain) => {
              const figures = p.figures.cards[domain] ?? null;
              const found = concluded !== null && concluded.reasons[domain] !== undefined;
              return (
                <li className="card card-border min-w-0" key={domain} data-testid={`competitor-${domain}`}>
                  <div className="card-body gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar domain={domain} />
                      <span className="flex min-w-0 flex-col items-start gap-1">
                        <span className="num min-w-0 text-sm wrap-anywhere">{domain}</span>
                        <span className="badge badge-ghost badge-sm gap-1">
                          {found ? <Sparkles size={14} strokeWidth={1.75} aria-hidden /> : <User size={14} strokeWidth={1.75} aria-hidden />}
                          {copy(found ? "settings.competitors.found" : "settings.competitors.added")}
                        </span>
                      </span>
                    </div>
                    {reasons?.[domain] === undefined ? null : (
                      <p className="text-xs text-base-content/70 wrap-anywhere">{reasons[domain]}</p>
                    )}
                    <div className="flex min-w-0 flex-col gap-2 text-sm">
                      <FigureLine
                        label={copy("settings.competitors.google")}
                        half={figures?.google ?? null}
                        pending={figures === null ? pending : null}
                        testId={`competitor-google-${domain}`}
                      />
                      <FigureLine
                        label={copy("settings.competitors.ai")}
                        half={figures?.ai ?? null}
                        pending={figures === null ? pending : null}
                        testId={`competitor-ai-${domain}`}
                      />
                    </div>
                    {/* Each rival is its own form's submit: pressing it removes that one rival on the server. */}
                    <form
                      action={(form) => {
                        setRemoving(domain);
                        startWriting(() => remove(form));
                      }}
                      className="mt-auto"
                    >
                      <input type="hidden" name={RIVAL_FIELD} value={domain} readOnly />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm"
                        aria-label={copy("setup.competitors.remove", { rival: domain })}
                        disabled={busy}
                      >
                        {busy && removing === domain ? (
                          <span className="loading loading-spinner loading-xs" aria-hidden />
                        ) : (
                          <X size={16} strokeWidth={1.75} aria-hidden />
                        )}
                        {copy("settings.competitors.remove")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}

            {more <= 0 ? null : (
              <li className="flex min-w-0 flex-col gap-2 rounded-box border border-dashed border-base-300 p-4">
                <form
                  action={(form) => {
                    setRemoving(null);
                    startWriting(() => add(form));
                  }}
                  className="flex min-w-0 flex-col gap-2"
                  data-testid="add-competitor"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-box bg-base-200 text-base-content/70">
                      <Users size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <label htmlFor="add-competitor-field" className="text-sm font-bold">
                        {copy("settings.competitors.add-label")}
                      </label>
                      <span className="text-xs text-base-content/70" data-testid="competitors-more">
                        {copy("settings.competitors.more", { n: String(more) })}
                      </span>
                    </span>
                  </div>
                  <input
                    id="add-competitor-field"
                    className={refusalLine === null ? "input num w-full" : "input input-error num w-full"}
                    name={RIVAL_FIELD}
                    placeholder={copy("settings.competitors.placeholder")}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    aria-invalid={refusalLine !== null}
                  />
                  {refusalLine === null ? null : <p className="text-xs text-error wrap-anywhere">{refusalLine}</p>}
                  <button type="submit" className="btn btn-ghost btn-sm self-start" disabled={busy}>
                    {busy && removing === null ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                    {copy("settings.competitors.add")}
                  </button>
                </form>
              </li>
            )}
          </ul>

          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-box bg-base-200 px-4 py-3 text-sm" data-testid="competitors-you">
            <span className="flex items-center gap-2 font-bold">
              <Avatar domain={p.ownDomain} you />
              {copy("settings.competitors.you")}
            </span>
            <span className="inline-flex flex-wrap gap-1" data-testid="competitors-you-google">
              {copy("settings.competitors.google")}
              <strong className="num">
                {you.google === null
                  ? copy("settings.competitors.not-measured")
                  : copy("settings.competitors.figure", { n: String(you.google.n), of: String(you.google.of) })}
              </strong>
            </span>
            <span data-testid="competitors-you-ai">
              {you.ai === null
                ? `${copy("settings.competitors.ai")} ${copy("settings.competitors.not-measured")}`
                : copy("settings.competitors.you.ai", { n: String(you.ai.n), of: String(you.ai.of), weeks: String(ANSWER_RATE_WEEKS) })}
            </span>
            <Link className="link link-primary sm:ml-auto" href={TAB_HREF.rivals}>
              {copy("settings.competitors.see")}
            </Link>
          </div>

          {p.leaders.length === 0 ? null : (
            <p className="text-sm text-base-content/70 wrap-anywhere" data-testid="competitors-leaders">
              {copy("settings.competitors.leaders", { names: p.leaders.join(", ") })}
            </p>
          )}

          <details className="collapse collapse-arrow card-border min-w-0" data-testid="settings-competitors-detail">
            <summary className="collapse-title text-sm font-semibold">{copy("settings.competitors.detail")}</summary>
            <div className="collapse-content flex min-w-0 flex-col gap-2 text-sm text-base-content/70">
              {detail.length === 0 ? null : <p className="wrap-anywhere">{detail.join(" ")}</p>}
              <p className="wrap-anywhere">{copy("settings.competitors.detail.change")}</p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
