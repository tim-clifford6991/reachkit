// The one way a Settings line is changed: *Change* opens a daisyUI `modal` on a native dialog, Save follows the busy
// pattern, Escape and Cancel discard, and focus returns to the *Change* that opened it. `save` absent is the read-only arm.
"use client";

import type React from "react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { say } from "@/app/_toast/say";
import { copy } from "@/lib/presentation/copy";
import { DIALOG_BOX, TARGET } from "./frame";
import type { SettingAnswer } from "./panel-state";

/** What a dialog's save answered: saved, with the panel's own line where its save started work, or why not. */
export type DialogAnswer = { ok: true; said?: string | null } | { ok: false; line: string };

const FIELD = "input:not([type=hidden]), textarea, select";

function Body(p: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  save?: (form: FormData) => Promise<DialogAnswer>;
  verb?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const form = useRef<HTMLFormElement>(null);
  const [refused, act, pending] = useActionState(async (_was: string | null, data: FormData): Promise<string | null> => {
    if (p.save === undefined) return null;
    const answer = await p.save(data).catch((): DialogAnswer => ({ ok: false, line: copy("settings.answer.refused") }));
    if (!answer.ok) return answer.line;
    p.dialog.current?.close();
    say(answer.said ?? copy("settings.answer.saved"), "ok");
    return null;
  }, null);

  // Each opening mounts a fresh body, so focus lands on its first field; a read-only body keeps it on ✕.
  useEffect(() => {
    if (p.save === undefined || p.dialog.current?.open !== true) return;
    form.current?.querySelector<HTMLElement>(FIELD)?.focus();
  }, [p.dialog, p.save]);

  const close = (): void => p.dialog.current?.close();
  // Read-only holds no form of its own, so a form inside it (the record's send) is never nested.
  if (p.save === undefined) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {p.children}
        <div className="modal-action mt-0 flex-wrap items-center">
          <button type="button" className="btn btn-soft min-h-11" onClick={close}>
            {copy("settings.close")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form ref={form} action={act} className="flex min-w-0 flex-col gap-4">
      {p.children}
      <div className="modal-action mt-0 flex-wrap items-center">
        {refused === null ? null : (
          <p role="alert" className="min-w-0 grow text-sm text-error wrap-anywhere" data-testid="dialog-refused">
            {refused}
          </p>
        )}
        <button type="submit" className="btn btn-primary min-h-11" disabled={pending}>
          {pending ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
          {p.verb ?? copy("settings.save")}
        </button>
        <button type="button" className="btn btn-ghost min-h-11" onClick={close}>
          {copy("settings.cancel-edit")}
        </button>
      </div>
    </form>
  );
}

export function EditDialog(p: {
  /** The line's label: the dialog's title, as drawn, and what *Change* is named for. */
  label: string;
  lead?: string | null;
  testId: string;
  save?: (form: FormData) => Promise<DialogAnswer>;
  /** A read-only list opens on *Show*, not *Change*. */
  show?: boolean;
  /** A line whose change has its own name opens on it, and saves on it. */
  verb?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(0);
  const title = useId();

  function open(): void {
    setOpened((n) => n + 1);
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={`btn btn-ghost ${TARGET} shrink-0 text-primary`}
        aria-label={p.verb ?? copy(p.show === true ? "settings.show.name" : "settings.change.name", { label: p.label })}
        aria-haspopup="dialog"
        onClick={open}
        data-testid={`${p.testId}-change`}
      >
        {p.verb ?? copy(p.show === true ? "settings.show" : "settings.change")}
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby={title} onClose={() => opener.current?.focus()} data-testid={p.testId}>
        <div className={DIALOG_BOX}>
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 grow flex-col gap-1">
              <h3 id={title} className="font-semibold wrap-anywhere">
                {p.label}
              </h3>
              {p.lead == null ? null : <p className="text-sm text-base-content/70 wrap-anywhere">{p.lead}</p>}
            </div>
            {/* Discards, as Cancel does. */}
            <button
              type="button"
              className="btn btn-ghost btn-square -my-2.5 size-11 shrink-0"
              aria-label={copy("settings.close")}
              onClick={() => dialog.current?.close()}
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {opened === 0 ? null : (
            <Body key={opened} dialog={dialog} save={p.save} {...(p.verb === undefined ? {} : { verb: p.verb })}>
              {p.children}
            </Body>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button tabIndex={-1} aria-hidden="true">
            {copy("settings.close")}
          </button>
        </form>
      </dialog>
    </>
  );
}

/** A list edited in a dialog: its items as chips or rows, each with Remove, and an Add field. The form carries the
 *  final list under `name`, the typed entry included, so Save writes the whole of what the customer left. */
export function StagedList(p: {
  items: readonly string[];
  name: string;
  /** The Add field's accessible name. */
  addLabel: string;
  placeholder?: string;
  max?: number;
  full?: string;
  /** Rows draw a line per item with its detail; chips are the default. */
  detail?: (item: string) => React.ReactNode;
}): React.JSX.Element {
  const [items, setItems] = useState<readonly string[]>(p.items);
  const [entry, setEntry] = useState("");
  const isFull = p.max !== undefined && items.length >= p.max;

  function add(): void {
    const text = entry.trim();
    if (text === "") return;
    const known = items.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase());
    if (!known && !isFull) setItems([...items, text]);
    setEntry("");
  }
  const remove = (item: string): void => setItems(items.filter((kept) => kept !== item));

  const removeButton = (item: string): React.JSX.Element => (
    <button
      type="button"
      className="btn btn-ghost btn-circle size-11 shrink-0"
      aria-label={copy("settings.business.remove", { item })}
      onClick={() => remove(item)}
    >
      <X size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-y-auto">
      {items.map((item) => (
        <input key={`kept:${item}`} type="hidden" name={p.name} value={item} />
      ))}
      {p.detail === undefined ? (
        <ul className="flex min-w-0 flex-wrap gap-2" data-testid="staged-items">
          {items.map((item) => (
            <li key={item} className="badge badge-ghost h-auto min-h-11 max-w-full min-w-0 gap-1 py-0 pr-0 pl-3.5 text-sm whitespace-normal wrap-anywhere">
              <span className="min-w-0">{item}</span>
              {removeButton(item)}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="list min-w-0" data-testid="staged-items">
          {items.map((item) => (
            <li key={item} className="list-row min-w-0 items-center gap-3 px-0">
              <div className="list-col-grow flex min-w-0 flex-col gap-1">
                <span className="num min-w-0 break-all">{item}</span>
                {p.detail!(item)}
              </div>
              {removeButton(item)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 gap-2">
        <input
          className="input min-h-11 min-w-0 grow"
          name={p.name}
          aria-label={p.addLabel}
          placeholder={p.placeholder ?? copy("settings.dialog.add.placeholder")}
          value={entry}
          disabled={isFull}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            add();
          }}
        />
        <button type="button" className="btn btn-soft btn-primary min-h-11 shrink-0" disabled={isFull} onClick={add}>
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          {copy("settings.business.add")}
        </button>
      </div>
      {isFull && p.full !== undefined ? <p className="text-sm text-base-content/70 wrap-anywhere">{p.full}</p> : null}
    </div>
  );
}

/** The list a dialog's form left under `name`, trimmed, and what it adds to and takes from the stored one. */
export function listChange(form: FormData, name: string, stored: readonly string[]): { added: string[]; removed: string[] } {
  const left = [...new Set(form.getAll(name).map((value) => String(value).trim()).filter((value) => value !== ""))];
  const has = (list: readonly string[], item: string): boolean =>
    list.some((other) => other.toLocaleLowerCase() === item.toLocaleLowerCase());
  return {
    added: left.filter((item) => !has(stored, item)),
    removed: stored.filter((item) => !has(left, item)),
  };
}

/** A setting write's answer, as a dialog states it. */
export function fromSetting(answer: SettingAnswer): DialogAnswer {
  if (answer.answer !== "saved") return { ok: false, line: copy("settings.answer.refused") };
  return { ok: true, said: copy(answer.effect === "now" ? "settings.answer.saved" : "settings.answer.saved-next-page") };
}

/** One text field, held as typed so a refused save keeps the words. */
export function TextField(p: { name: string; label: string; value: string; rows?: number; placeholder?: string | null; email?: boolean }): React.JSX.Element {
  const [text, setText] = useState(p.value);
  const shared = {
    name: p.name,
    "aria-label": p.label,
    value: text,
    ...(p.placeholder == null ? {} : { placeholder: p.placeholder }),
  };
  return p.rows === undefined ? (
    <input className="input w-full min-w-0" {...shared} {...(p.email === true ? { type: "email", autoComplete: "email" } : {})} onChange={(e) => setText(e.target.value)} />
  ) : (
    <textarea className="textarea h-auto w-full min-w-0" rows={p.rows} {...shared} onChange={(e) => setText(e.target.value)} />
  );
}
