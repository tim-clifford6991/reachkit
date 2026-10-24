// BUILD §4.7, REQ-055, REQ-053 — "How your pages sound".
//
// These two answers have a card of their own (issue #374): they constrain what
// a page will say, and the voice is a description, so it gets a textarea.
//
// Two settings and no third:
//
//  · **the voice** (REQ-055) — ONE field, and the whole of what ReachKit
//    knows about how a customer's pages should sound. Nothing is learned
//    about them and no second field infers a tone: the customer writes it or
//    it is empty. A `textarea`, because a description is a paragraph.
//  · **the never-claim list** (REQ-053) — entries the customer adds and
//    removes, each a claim their pages must never make, with the one written
//    line saying what the list *does*: it is a hard filter, and a draft that
//    matches an entry is held and returned to them naming the entry. That
//    line is the difference between a preference and a guarantee, which is
//    why the card states it rather than leaving the list to speak for itself.
//
// **Neither is an engine parameter** and that is why they may be here at all
// (REQ-070 criterion 3). They are constraints on content published under the
// customer's own name — §14.6 makes the customer the publisher of record —
// not a cap, a cadence, a model choice or a weight. Both keys are in
// `SETTABLE`, and `tests/app/settings/screen.test.tsx` reads every rendered
// `setting-<key>` off the document and asserts the set against it, so moving
// them between cards cannot lose one.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { ArrowRight, Ban, Check, FileText, MailCheck, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { saveVoiceAction, saveWritingVoiceAction } from "../change-actions";
import { say } from "@/app/_toast/say";
import { addClaimAction, removeClaimAction } from "../panel-actions";
import { CLAIM_FIELD } from "../panel-state";
import { VOICE_FIELD, WRITING_VOICE_AUTO, WRITING_VOICE_FIELD, WRITING_VOICE_OPTIONS } from "../voice-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import type { SettingsModel } from "../model";

/** One claim, as the remove action reads it. A `FormData` because both
 *  claim writes are ordinary form actions and share one reader. */
function formWith(entry: string): FormData {
  const form = new FormData();
  form.set(CLAIM_FIELD, entry);
  return form;
}

export function VoicePanel(p: {
  settings: SettingsModel;
  /** The name the guide voice and the held-back example use; the domain where the site has none. */
  business?: string | null;
}): React.JSX.Element {
  const business = p.business ?? p.settings.domain;
  // Issue 1196: the voice text's own press — it answers, and spins while it
  // is asked, like every other Settings save.
  const [savingVoice, startSavingVoice] = useTransition();
  function saveVoice(form: FormData): void {
    startSavingVoice(async () => {
      try {
        await saveVoiceAction(form);
        say(copy("settings.answer.saved"), "ok");
      } catch {
        say(copy("settings.answer.refused"), "bad");
      }
    });
  }
  // SPEC §7 (owner, 2026-10-10; issue 1390): who speaks on their pages.
  // Saved as it is chosen: one radio list, no second press.
  const [writing, setWriting] = useState<string>(p.settings.voice.writing ?? WRITING_VOICE_AUTO);
  const [savingWriting, startSavingWriting] = useTransition();
  function chooseWriting(value: string): void {
    setWriting(value);
    const form = new FormData();
    form.set(WRITING_VOICE_FIELD, value);
    startSavingWriting(async () => {
      try {
        await saveWritingVoiceAction(form);
        say(copy("settings.answer.saved"), "ok");
      } catch {
        say(copy("settings.answer.refused"), "bad");
      }
    });
  }
  const filterNote = writtenLine("settings.voice.filter-note");
  const placeholder = writtenLine("settings.voice.placeholder");
  // SPEC §4 (2026-09-20, #908, issue #913): the never-claim list writes.
  // Both halves of it were inert — the × on each tag and the Add beside
  // the field — so a filter the customer could not add to and could not
  // remove from was drawn as though they owned it. Both now reach
  // `saveDoNotClaim`, which is the product's one writer of the column and
  // re-checks every page the change affects in the same call.
  const writer = useSetting();
  // What is being typed into the add field. Controlled for the reason the
  // voice box is: React resets a form after its action, and a box that
  // emptied itself the moment it was refused would throw the words away.
  const [claim, setClaim] = useState("");
  // The stored voice, and the customer's edit of it in flight. Controlled
  // for `MarketPanel`'s reason: React resets a form after its action, and
  // a box that emptied itself the moment it saved would look like the save
  // had thrown the text away.
  const [text, setText] = useState(p.settings.voice.text);

  return (
    <>
      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body gap-4">
          <h2 className="card-title min-w-0 wrap-anywhere text-base">{copy("settings.voice.title")}</h2>
          <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.voice.lead")}</p>
          {/* SPEC §5 (2026-09-12): the summary setup showed, stored where
              drafting reads it. One field and one press. */}
          <form action={saveVoice} className="flex min-w-0 flex-col gap-3">
            <label className="flex min-w-0 flex-col gap-1" data-testid="setting-voice_text">
              <span className="text-sm font-semibold">{copy("settings.content.voice")}</span>
              <textarea
                className="textarea h-auto w-full"
                rows={4}
                name={VOICE_FIELD}
                value={text}
                onChange={(e) => setText(e.target.value)}
                {...(placeholder === null ? {} : { placeholder })}
              />
            </label>
            <NoteExample />
            <span>
              <button type="submit" className="btn btn-soft btn-primary btn-sm" disabled={savingVoice}>
                {savingVoice ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy("settings.voice.save")}
              </button>
            </span>
          </form>
        </div>
      </section>

      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body gap-4">
          {/* SPEC §7 (owner, 2026-10-10; issue 1390): who speaks on their pages, saved as it is chosen. */}
          <fieldset className="flex min-w-0 flex-col gap-3" data-testid="setting-writing_voice" disabled={savingWriting}>
            <legend className="card-title mb-3 min-w-0 wrap-anywhere text-base">{copy("settings.voice.writing.label")}</legend>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4" data-layout="choices">
              {VOICE_CHOICES.map((choice) => {
                const chosen = writing === choice.voice;
                return (
                  <label
                    key={choice.voice}
                    className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-box border p-3 ${
                      chosen ? "border-primary bg-primary/10" : "border-base-300"
                    }`}
                    data-testid={`writing-voice-${choice.voice}`}
                  >
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm mt-0.5"
                      name={WRITING_VOICE_FIELD}
                      value={choice.voice}
                      checked={chosen}
                      onChange={() => chooseWriting(choice.voice)}
                    />
                    <span className="flex min-w-0 flex-col gap-1 wrap-anywhere">
                      <span className="text-sm font-semibold">{copy(choice.key)}</span>
                      <span className="text-sm text-base-content/70">
                        {choice.voice === "guide" ? copy(choice.example, { business }) : copy(choice.example)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.voice.writing.note")}</p>
        </div>
      </section>

      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body gap-4" data-testid="setting-do_not_claim">
          <h2 className="card-title min-w-0 flex-wrap text-base">
            <span className="min-w-0 wrap-anywhere">{copy("settings.voice.never-claim")}</span>
            {writer.saved ? (
              <span className={SAVED_BADGE_CLASS} data-testid="voice-saved">
                {copy("settings.answer.saved-badge")}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.voice.never-claim.lead")}</p>
          {/* Each claim with its own way out: a filter the customer cannot
              remove from is not theirs. A claim is a sentence, so it wraps. */}
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.settings.doNotClaim.map((entry) => (
              <span className="min-w-0 max-w-full" key={entry} data-testid={`claim-${entry}`}>
                <button
                  type="button"
                  className="badge badge-outline badge-lg h-auto max-w-full cursor-pointer gap-1 text-left"
                  aria-label={copy("settings.voice.remove-claim", { claim: entry })}
                  disabled={writer.busy}
                  onClick={() => writer.press(removeClaimAction, formWith(entry))}
                >
                  <span className="num num-phrase min-w-0">{entry}</span>
                  <X size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </span>
            ))}
          </div>
          {/* A form, so the field submits on Enter as well as on the press,
              and so the whole control works from a plain submit. */}
          <form
            action={(form) => {
              writer.press(addClaimAction, form);
              setClaim("");
            }}
            className="flex min-w-0 flex-wrap items-end gap-2"
          >
            <label className="flex min-w-0 grow flex-col gap-1">
              <span className="text-sm font-semibold">{copy("settings.voice.add-claim")}</span>
              <input
                className="input w-full"
                name={CLAIM_FIELD}
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                data-testid="add-claim"
              />
            </label>
            {/* Named, for the reason #328 gives on the business panel: the
                field's own sentence, so the control is not just "Add" in a
                list of controls. */}
            <button
              type="submit"
              className="btn btn-soft btn-primary btn-sm"
              aria-label={copy("settings.voice.add-claim")}
              disabled={writer.busy}
            >
              {writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
              {copy("settings.voice.add")}
            </button>
          </form>
          <HeldBackExample business={business} />
          {filterNote === null ? null : <p className="text-sm text-base-content/70 wrap-anywhere">{filterNote}</p>}
        </div>
      </section>
    </>
  );
}

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Every voice on offer, ReachKit's own choice first, each with its fixed example sentence. */
const VOICE_CHOICES = [
  { voice: WRITING_VOICE_AUTO, key: "settings.voice.writing.auto", example: "settings.voice.writing.auto.example" },
  ...WRITING_VOICE_OPTIONS,
] as const;

/** The same paragraph without and with a note: fixed words, labelled as an example. */
function NoteExample(): React.JSX.Element {
  return (
    <figure className="flex min-w-0 flex-col gap-3" data-testid="voice-example">
      <p className="eyebrow">{copy("settings.voice.example.head")}</p>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2" data-layout="pair">
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-box bg-base-200 p-4">
          <span className="badge badge-ghost">{copy("settings.voice.example.without")}</span>
          <p className="text-sm wrap-anywhere">{copy("settings.voice.example.without.text")}</p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-box border border-primary/30 p-4">
          <span className="badge badge-soft badge-primary gap-1" data-testid="voice-example-with">
            <Check {...ICON} />
            {copy("settings.voice.example.with")}
          </span>
          <p className="text-sm wrap-anywhere">{copy("settings.voice.example.with.text")}</p>
        </div>
      </div>
      <figcaption className="text-xs text-base-content/70 wrap-anywhere">{copy("settings.voice.example.caption")}</figcaption>
    </figure>
  );
}

/** The quote with its listed claim struck through, as the board draws it; the whole quote where the claim is not in it. */
function StruckClaim(p: { quote: string; claim: string }): React.JSX.Element {
  const at = p.quote.indexOf(p.claim);
  if (at === -1) return <>{p.quote}</>;
  return (
    <>
      {p.quote.slice(0, at)}
      <s>{p.claim}</s>
      {p.quote.slice(at + p.claim.length)}
    </>
  );
}

/** What happens to a page that says an entry on the list, as one fixed example. */
function HeldBackExample(p: { business: string }): React.JSX.Element {
  const label = copy("settings.voice.held.example");
  return (
    <figure
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-box bg-base-200 p-4 text-sm"
      aria-label={label}
      data-testid="voice-held-back"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-field bg-base-100 text-base-content/70">
          <FileText {...ICON} />
        </span>
        <span className="min-w-0 wrap-anywhere">
          <StruckClaim quote={copy("settings.voice.held.quote", { business: p.business })} claim={copy("settings.voice.held.claim")} />
        </span>
      </span>
      <ArrowRight {...ICON} className="shrink-0 text-base-content/70" />
      <span className="badge badge-soft badge-warning h-auto gap-1">
        <Ban {...ICON} />
        {copy("settings.voice.held.badge")}
      </span>
      <ArrowRight {...ICON} className="shrink-0 text-base-content/70" />
      <span className="flex min-w-0 items-center gap-2">
        <MailCheck {...ICON} className="shrink-0 text-primary" />
        <span className="min-w-0 wrap-anywhere">{copy("settings.voice.held.told")}</span>
      </span>
    </figure>
  );
}
