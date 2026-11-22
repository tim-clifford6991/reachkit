// BUILD §4.7 — the Account card: name, the sign-in address and its change, the pages and their export, then the
// card's shortcuts. Whether an address change can be used, went out or lapses is `src/lib/account/identity/`'s,
// reached through `../account-actions.ts`; the card renders the answer it is handed. There is no password anywhere
// because there is no password in the product (§13: identity is a magic link).
"use client";

import type React from "react";
import { CircleQuestionMark, Download, ExternalLink, LogOut } from "lucide-react";
import { useTransition } from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { HELP_MAILTO } from "../../_shell/Shortcuts";
import { useAction } from "./useAction";
import { SettingLine } from "./SettingRow";
import { EditDialog, TextField, type DialogAnswer } from "../EditDialog";
import { beginEmailChangeAction, cancelEmailChangeAction } from "../account-actions";
import { EMAIL_CHANGE_INITIAL, NEW_EMAIL_FIELD, refusalKeyOf } from "../account-state";
import { CARD, CARD_BODY, CARD_FOOT, CARD_LEAD, CARD_TITLE, SOFT, TARGET } from "../frame";
import type { SettingsModel } from "../model";

const GHOST = `btn btn-ghost ${TARGET}`;

async function changeEmail(form: FormData): Promise<DialogAnswer> {
  const state = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, form);
  const refusal = refusalKeyOf(state);
  if (refusal === null) return { ok: true };
  return { ok: false, line: writtenLine(refusal) ?? copy("settings.answer.refused") };
}

export function AccountPanel(p: { account: SettingsModel["account"]; pages: number; blog: string | null }): React.JSX.Element {
  const action = useAction();
  const [cancelling, startCancelling] = useTransition();
  const pending = p.account.pending;
  const name = p.account.name ?? "";
  // The first note belongs under the address; the rest say where the change does not reach, so they sit in its dialog.
  const [signIn, ...elsewhere] = p.account.noteKeys.map((key) => writtenLine(key)).filter((line): line is string => line !== null);
  // Split around the moment so it alone is mono.
  const [beforeAt = "", afterAt = ""] = pending === null ? [] : copy("settings.account.email-pending-expires", { at: "\u0000" }).split("\u0000");
  const pagesLine = p.pages === 1 ? copy("settings.account.pages.one") : copy("settings.account.pages.count", { pages: String(p.pages) });
  const busy = (key: "export" | "sign_out", icon: React.ReactNode): React.ReactNode =>
    action.pending === key ? <span className="loading loading-spinner loading-xs" aria-hidden /> : icon;

  return (
    <section className={CARD}>
      <div className={CARD_BODY}>
        <h2 className={CARD_TITLE}>{copy("settings.account.title")}</h2>

        <div className="flex min-w-0 flex-col">
          <SettingLine label={copy("settings.account.name")} value={{ kind: "text", text: name, full: name }} testId="setting-name" />
          {/* The address the account signs in with, never the one awaiting confirmation (REQ-077 c2). */}
          <SettingLine
            label={copy("settings.account.email")}
            value={{ kind: "address", text: p.account.email }}
            testId="setting-email"
            action={
              <EditDialog label={copy("settings.account.email")} verb={copy("settings.account.change-email")} testId="email-change" save={changeEmail}>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold">{copy("settings.account.new-email")}</span>
                  <TextField name={NEW_EMAIL_FIELD} label={copy("settings.account.new-email")} value={pending?.email ?? ""} email />
                </label>
                {elsewhere.map((line) => (
                  <p key={line} className={CARD_LEAD}>
                    {line}
                  </p>
                ))}
              </EditDialog>
            }
          />
          {signIn === undefined ? null : <p className={`${CARD_LEAD} pb-1`}>{signIn}</p>}
          {pending === null ? null : (
            <div className="bg-base-200 rounded-box flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" data-testid="email-pending">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-mono text-sm break-all" data-testid="email-pending-address">
                  {pending.email}
                </span>
                <span className="badge badge-warning badge-soft badge-sm">{copy("settings.account.email-pending")}</span>
              </span>
              <span className="min-w-0 grow text-sm wrap-anywhere">
                {beforeAt}
                <span className="num">{pending.expiresAt}</span>
                {afterAt}
              </span>
              <form action={() => startCancelling(() => cancelEmailChangeAction())}>
                <button type="submit" className={GHOST} disabled={cancelling}>
                  {cancelling ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                  {copy("settings.account.cancel-change")}
                </button>
              </form>
            </div>
          )}
          {/* REQ-078: export is always available, so nothing gates this control. */}
          <SettingLine
            label={copy("settings.account.pages")}
            value={{ kind: "text", text: pagesLine, full: pagesLine }}
            testId="action-export"
            action={
              <button type="button" className={`${SOFT} shrink-0`} onClick={() => action.run("export")} disabled={action.pending !== null}>
                {busy("export", <Download size={16} strokeWidth={1.75} aria-hidden />)}
                {copy("settings.content.export")}
              </button>
            }
          />
        </div>

        <div className={CARD_FOOT}>
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="flex min-w-0" data-testid="action-sign_out">
              <button type="button" className={GHOST} onClick={() => action.run("sign_out")} disabled={action.pending !== null}>
                {busy("sign_out", <LogOut size={16} strokeWidth={1.75} aria-hidden />)}
                {copy("settings.account.sign-out")}
              </button>
            </span>
            {/* Drawn only where a live hosted blog answers (SPEC §4: a control that cannot act is not drawn). */}
            {p.blog === null ? null : (
              <a className={GHOST} href={p.blog} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
                {copy("shell.shortcut.blog")}
              </a>
            )}
            <a className={GHOST} href={HELP_MAILTO}>
              <CircleQuestionMark size={16} strokeWidth={1.75} aria-hidden />
              {copy("shell.shortcut.help")}
            </a>
          </span>
        </div>

        {action.line === null ? null : <p className={CARD_LEAD}>{action.line}</p>}
      </div>
    </section>
  );
}
