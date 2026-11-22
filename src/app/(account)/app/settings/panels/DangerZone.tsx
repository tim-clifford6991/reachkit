// BUILD §4.7 — the Danger Zone: two actions, each opening one dialog. Step 1 states what happens, takes the export
// (REQ-079 c3) and the typed words (c2); deleting then asks "Are You Sure?" in the same dialog before anything runs.
// The words are the registry's, compared again on the server, so this check arms a control and guards nothing alone.
"use client";

import type React from "react";
import { X } from "lucide-react";
import { Linked } from "../Linked";
import { CARD, CARD_BODY, CARD_LEAD, CARD_TITLE, DIALOG_BOX, TARGET } from "../frame";
import { useEffect, useRef, useState, useTransition } from "react";
import { ERASURE_DAYS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { ActionKey } from "../settable";
import { SETTINGS_TAB_HREF } from "../tabs";
import { handoverState, runDangerAction } from "../danger-actions";
import {
  CONFIRM_WORD_KEY,
  canConfirm,
  matchesConfirmWord,
  type DangerActionKey,
  type DangerOutcome,
  type HandoverState,
} from "../danger-state";

/** How long the step keeps re-reading the stamp after a press: a large archive streams for a while. */
const HANDOVER_POLL_MS = 1000;
const HANDOVER_POLL_TRIES = 180;

/** Re-reads the stamp until the download has finished, because the press only starts it. */
async function waitForHandover(action: DangerActionKey): Promise<HandoverState> {
  for (let i = 0; i < HANDOVER_POLL_TRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, HANDOVER_POLL_MS));
    const state = await handoverState(action).catch(() => ({ taken: false }));
    if (state.taken) return state;
  }
  return { taken: false };
}

/** What deleting does, said in the "Are you sure?" step before anything runs. */
const SURE_LINES: readonly CopyKey[] = [
  "danger.delete-account.sure.hosted",
  "danger.delete-account.sure.plan",
  "danger.delete-account.sure.closed",
  "danger.delete-account.sure.wordpress",
  "danger.delete-account.sure.kept",
  "danger.delete-account.sure.erased",
];
const DAYS = { days: String(ERASURE_DAYS) };

const DANGER: readonly { action: Extract<ActionKey, "unpublish_all" | "delete_account">; label: CopyKey; consequence: CopyKey }[] = [
  {
    action: "unpublish_all",
    label: "danger.unpublish-all",
    consequence: "danger.unpublish-all.consequence",
  },
  {
    action: "delete_account",
    label: "danger.delete-account",
    consequence: "danger.delete-account.consequence",
  },
];

export function DangerZone(): React.JSX.Element {
  const action = useAction();

  return (
    <section className={CARD} data-testid="settings-danger">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 flex-col">
          <h2 className={CARD_TITLE}>{copy("danger.zone.title")}</h2>
          <p className={CARD_LEAD}>{copy("danger.zone.lead")}</p>
        </div>
        <p className="min-w-0 text-sm wrap-anywhere" data-testid="danger-pause-line">
          <Linked sentence={copy("danger.pause.line")} word={copy("danger.pause.link")} href={SETTINGS_TAB_HREF.pages} />
        </p>
        <div className="flex min-w-0 flex-wrap gap-2 pt-1">
          {DANGER.map((row) => (
            <DangerStep key={row.action} row={row} action={action} />
          ))}
        </div>
        {action.line === null ? null : <p className={CARD_LEAD}>{action.line}</p>}
      </div>
    </section>
  );
}

/**
 * One action's dialog. A component of its own so each holds its own typed word and its own reading of the
 * handover: two open at once could otherwise confirm each other's action.
 */
function DangerStep(p: {
  row: (typeof DANGER)[number];
  action: ReturnType<typeof useAction>;
}): React.JSX.Element {
  const [running, startRunning] = useTransition();
  const [typed, setTyped] = useState("");
  const [handover, setHandover] = useState<HandoverState>({ taken: false });
  const [sure, setSure] = useState(false);
  // Never the delete arm: that one navigates, because the account it belonged to is gone.
  const [outcome, setOutcome] = useState<RenderedOutcome | null>(null);

  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const consequence = writtenLine(p.row.consequence, DAYS);
  const word = copy(CONFIRM_WORD_KEY[p.row.action]);
  const armed = matchesConfirmWord(p.row.action, typed, word);
  const id = `danger-${p.row.action}`;

  // Step 2 opens on Keep, so a stray Enter keeps the account.
  useEffect(() => {
    if (sure) keep.current?.focus();
  }, [sure]);

  const run = (): void => {
    startRunning(async () => {
      const result = await runDangerAction(p.row.action, typed);
      if (result.ran && result.action === "delete_account") {
        window.location.assign(result.href);
        return;
      }
      // A run spends the ticket and a refusal asks for a fresh one, so the download is offered again.
      if (result.lineKey !== "danger.type-to-confirm") setHandover({ taken: false });
      setSure(false);
      setOutcome(result);
    });
  };

  return (
    <span className="flex min-w-0" data-testid={`action-${p.row.action}`}>
      <button ref={opener} type="button" className={`btn btn-error ${TARGET}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {copy(p.row.label)}
      </button>
      {/* Esc, the backdrop and Keep close it and run nothing. */}
      <dialog
        ref={dialog}
        className="modal"
        role={sure ? "alertdialog" : "dialog"}
        aria-labelledby={`${id}-title`}
        {...(sure ? { "aria-describedby": `${id}-sure` } : {})}
        onClose={() => {
          setSure(false);
          opener.current?.focus();
        }}
        data-testid={id}
      >
        {sure ? (
          <div className={DIALOG_BOX} data-testid="danger-sure">
            <h3 id={`${id}-title`} className="font-semibold">{copy("danger.delete-account.sure.title")}</h3>
            <ul id={`${id}-sure`} className="flex list-disc flex-col gap-1 ps-5 text-sm wrap-anywhere">
              {SURE_LINES.map((key) => <li key={key}>{copy(key, DAYS)}</li>)}
            </ul>
            <div className="modal-action mt-0 flex-wrap">
              <button ref={keep} type="button" className="btn btn-soft min-h-11" disabled={running} onClick={() => dialog.current?.close()}>
                {copy("danger.delete-account.keep")}
              </button>
              <button type="button" className="btn btn-error min-h-11" disabled={running} onClick={run}>
                {running ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy(p.row.label)}
              </button>
            </div>
          </div>
        ) : (
          <div className={DIALOG_BOX}>
            <div className="flex min-w-0 items-start gap-2">
              <h3 id={`${id}-title`} className="min-w-0 grow font-semibold wrap-anywhere">{copy(p.row.label)}</h3>
              <button type="button" className="btn btn-ghost btn-square min-h-11 shrink-0" aria-label={copy("settings.close")} onClick={() => dialog.current?.close()}>
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            {consequence === null ? null : <p className="text-sm wrap-anywhere" data-testid={`consequence-${p.row.action}`}>{consequence}</p>}

            {/* Gate 1, the export, re-read from the ticket rather than assumed from the press. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid={`export-${p.row.action}`}>
              <span className={CARD_LEAD}>{handover.taken ? copy("danger.export-taken") : copy("danger.export-take")}</span>
              {handover.taken ? null : (
                <button
                  type="button"
                  className="btn btn-soft btn-primary min-h-11"
                  onClick={() => {
                    p.action.run(p.row.action);
                    void waitForHandover(p.row.action).then(setHandover);
                  }}
                >
                  {copy("settings.content.export")}
                </button>
              )}
            </div>

            {/* Gate 2, the typed words. */}
            <div className="flex min-w-0 flex-col gap-2" data-testid={`confirm-word-${p.row.action}`}>
              <label htmlFor={`confirm-field-${p.row.action}`} className="text-sm font-semibold">
                {copy("danger.type-to-confirm", { word })}
              </label>
              <input id={`confirm-field-${p.row.action}`} className="input min-h-11 w-full min-w-0" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>

            {outcome === null ? null : <DangerLine outcome={outcome} />}

            <div className="modal-action mt-0 flex-wrap" data-testid={`confirm-${p.row.action}`}>
              <button type="button" className="btn btn-ghost min-h-11" onClick={() => dialog.current?.close()}>
                {copy("settings.cancel-edit")}
              </button>
              <button
                type="button"
                className="btn btn-error min-h-11"
                disabled={!canConfirm(handover, armed) || running}
                onClick={() => (p.row.action === "delete_account" ? setSure(true) : run())}
              >
                {running ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy(p.row.label)}
              </button>
            </div>
          </div>
        )}
        <form method="dialog" className="modal-backdrop">
          <button tabIndex={-1} aria-hidden="true">{copy("settings.close")}</button>
        </form>
      </dialog>
    </span>
  );
}

/** What the run left behind, as the keys the engine named. No sentence is
 *  composed here and no count is derived: `takenDown` is the run's own. */
type RenderedOutcome = Exclude<DangerOutcome, { action: "delete_account" }>;

function DangerLine(p: { outcome: RenderedOutcome }): React.JSX.Element {
  const line = writtenLine(p.outcome.lineKey);
  return (
    <div className="flex min-w-0 flex-col gap-1" role="status" data-testid="danger-outcome">
      {line === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{line}</p>}
      {p.outcome.ran ? (
        <>
          <p className="text-xs text-base-content/70 wrap-anywhere">
            {copy("danger.taken-down-count", { pages: String(p.outcome.takenDown) })}
          </p>
          {p.outcome.stillLive.length === 0 ? null : (
            <ul className="flex min-w-0 flex-col gap-1" data-testid="danger-still-live">
              {p.outcome.stillLive.flatMap((destination) =>
                destination.liveUrls.map((url) => (
                  <li key={url} className="num text-xs text-base-content/70 wrap-anywhere">
                    {url}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-base-content/70 wrap-anywhere">{copy("danger.nothing-changed")}</p>
      )}
    </div>
  );
}
