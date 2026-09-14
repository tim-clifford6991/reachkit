// SPEC §4 — the domain block at the head of the shell: a dot, the domain,
// and the week line.
//
// Two arms, from `WeekCount` (REQ-040 c6 and c7): a counted number of
// measured weeks with the date of the last one, or — where this domain has
// never been measured — no number at all and one written line naming the
// date the first measurement is due. The dot is a daisyUI `status` and is
// decoration only (`aria-hidden`); the words carry the meaning.
//
// Both lines go through `writtenLine`: an unwritten key renders the domain
// alone rather than throwing.
import type React from "react";
import { formatDate } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";

export function DomainBlock(p: { shell: ShellModel }): React.JSX.Element {
  const { shell } = p;
  const line =
    shell.weeks.kind === "counted"
      ? writtenLine("shell.domain.measured-weeks", {
          weeks: shell.weeks.weeks,
          on: formatDate(shell.weeks.lastMeasuredOn, shell.timeZone),
        })
      : writtenLine("shell.domain.not-measured", {
          due: formatDate(shell.weeks.firstDueOn, shell.timeZone),
        });

  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="shell-domain">
      <p className="flex min-w-0 items-center gap-2 font-semibold">
        <span className="status status-primary shrink-0" aria-hidden="true" />
        {/* A domain is a URL-shaped value: mono. */}
        <span className="num truncate" title={shell.domain}>
          {shell.domain}
        </span>
      </p>
      {line === null ? null : (
        <p className="text-xs opacity-60" data-testid="shell-domain-line">
          {line}
        </p>
      )}
    </div>
  );
}
