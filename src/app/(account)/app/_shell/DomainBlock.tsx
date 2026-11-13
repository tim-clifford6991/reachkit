// SPEC §4 — the domain block in the shell: the site's own mark, the domain,
// and the week line.
//
// From `WeekCount` (REQ-040 c6 and c7): a counted number of measured weeks
// with the date of the last one, or — before the first weekly pass — no
// number at all: the deep pass checking now, the day it checked and the
// next date, or, with no pass yet, the date the first is due. The mark is decoration (`aria-hidden`);
// the domain beside it carries the meaning.
//
// Both lines go through `writtenLine`: an unwritten key renders the domain
// alone rather than throwing.
import type React from "react";
import { SiteMark } from "@/ui/SiteMark";
import { formatDate } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";

/** A counted week wins; before one, the newest deep pass says the site is being checked or when it was. */
function domainLine(shell: ShellModel): string | null {
  if (shell.weeks.kind === "counted") {
    return writtenLine("shell.domain.measured-weeks", {
      weeks: shell.weeks.weeks,
      on: formatDate(shell.weeks.lastMeasuredOn, shell.timeZone),
    });
  }
  const due = formatDate(shell.weeks.firstDueOn, shell.timeZone);
  // A model assembled without the pass read states the due date, as before.
  const pass = shell.pass ?? null;
  if (pass === null) return writtenLine("shell.domain.not-measured", { due });
  if (pass.kind === "running") return writtenLine("shell.domain.checking");
  return writtenLine("shell.domain.checked", { on: formatDate(new Date(pass.end.at), shell.timeZone), due });
}

export function DomainBlock(p: { shell: ShellModel }): React.JSX.Element {
  const { shell } = p;
  const line = domainLine(shell);
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="shell-domain">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <SiteMark domain={shell.domain} hasLogo={shell.hasLogo} size={20} />
        {/* A domain is a URL-shaped value: mono. */}
        <span className="num truncate text-base-content/70" title={shell.domain}>
          {shell.domain}
        </span>
      </p>
      {line === null ? null : (
        <p className="text-xs opacity-70" data-testid="shell-domain-line">
          {line}
        </p>
      )}
    </div>
  );
}
