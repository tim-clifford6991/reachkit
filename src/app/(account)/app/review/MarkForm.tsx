"use client";
// One row's OK and Flag, with the house busy pattern: the pressed button spins and both are disabled while it saves; a
// save that failed says so beside them and the row keeps its last mark. With `note`, the flag is saved with a note.
import type React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleCheck, Flag } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { MarkResult, MarkValue } from "./model";

const MARK = "mark";
const OK: MarkValue = "ok";
const FLAG: MarkValue = "flag";

function Press(p: { value: MarkValue; pressed: boolean; label: string; icon: React.ReactNode; tone: string }): React.JSX.Element {
  const { pending, data } = useFormStatus();
  const busy = pending && data?.get(MARK) === p.value;
  // Pressed is filled and outlined by its own icon; unpressed is ghost, so a mark reads in greyscale too.
  return (
    <button type="submit" name={MARK} value={p.value} disabled={pending} aria-pressed={p.pressed} aria-busy={busy || undefined} className={`btn btn-sm join-item ${p.pressed ? p.tone : "btn-ghost"}`}>
      {busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : p.icon}
      {p.label}
    </button>
  );
}

export function MarkForm(p: {
  action: (prev: MarkResult, form: FormData) => Promise<MarkResult>;
  siteId: string;
  opportunityId: string;
  /** The row's title, or its search: what the group is named by. */
  row: string;
  mark: MarkValue | null;
  note?: string | null;
}): React.JSX.Element {
  const [result, act] = useActionState(p.action, null);
  const withNote = p.note !== undefined;
  return (
    <form action={act} className="flex min-w-0 flex-wrap items-center gap-2">
      <input type="hidden" name="site" value={p.siteId} />
      <input type="hidden" name="opportunity" value={p.opportunityId} />
      {withNote ? <input name="note" maxLength={280} defaultValue={p.note ?? ""} aria-label={copy("review.note")} placeholder={copy("review.note")} className="input input-sm min-w-0" /> : null}
      <div role="group" aria-label={copy("review.mark.group", { row: p.row })} className="join">
        <Press value={OK} pressed={p.mark === OK} label={copy("review.mark.ok")} icon={p.mark === OK ? <CircleCheck aria-hidden className="size-4" /> : <Check aria-hidden className="size-4" />} tone="btn-success" />
        <Press
          value={FLAG}
          pressed={p.mark === FLAG && !withNote}
          label={copy(withNote ? "review.note.save" : "review.mark.flag")}
          icon={<Flag aria-hidden className={`size-4 ${p.mark === FLAG ? "fill-current" : ""}`} />}
          tone="btn-warning"
        />
      </div>
      {result === "failed" ? (
        <span role="alert" className="text-sm text-error">
          {copy("review.mark.failed")}
        </span>
      ) : null}
    </form>
  );
}
