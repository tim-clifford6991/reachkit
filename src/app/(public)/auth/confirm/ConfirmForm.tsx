"use client";

import type React from "react";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

/** The confirm page's one form. A plain post that works without script;
 *  with script the button locks on the first press, because a second post
 *  would find the link spent and land on the dead-link screen. */
export function ConfirmForm(p: {
  action: string;
  fields: Readonly<Record<string, string>>;
  label: string;
}): React.JSX.Element {
  const [sent, setSent] = useState(false);
  return (
    <form method="post" action={p.action} className="card border border-base-300 bg-base-100 flex flex-col gap-4 p-6" onSubmit={() => setSent(true)}>
      {Object.entries(p.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="btn btn-primary btn-block" disabled={sent} aria-busy={sent || undefined}>
        {p.label}
        <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </form>
  );
}
