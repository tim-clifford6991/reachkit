// SPEC §4 (board Main) — the head of Overview: the week and the day, whether
// anything needs the customer, and in one line how many pages are live, how
// many show in Google and when this week's were chosen.
import type React from "react";
import Link from "next/link";

export function OverviewHead(p: {
  eyebrow: string;
  title: string;
  /** The one control a page that needs the customer carries; `null` otherwise. */
  action: { label: string; href: string } | null;
  lead: string | null;
}): React.JSX.Element {
  return (
    <header className="flex min-w-0 flex-col gap-1" data-testid="overview-head">
      <p className="num text-xs font-semibold uppercase tracking-wide text-base-content/70" data-testid="overview-head-eyebrow">
        {p.eyebrow}
      </p>
      <h1 className="min-w-0">{p.title}</h1>
      {p.lead === null ? null : (
        <p className="min-w-0 text-base-content/70" data-testid="overview-head-lead">
          {p.lead}
        </p>
      )}
      {p.action === null ? null : (
        <Link className="btn btn-soft btn-warning btn-sm self-start" href={p.action.href} prefetch={true}>
          {p.action.label}
        </Link>
      )}
    </header>
  );
}
