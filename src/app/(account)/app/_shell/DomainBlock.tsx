// Canvas: Dashboard — the domain, and the week it was last measured in.
//
// Two arms: a counted number of measured weeks with the date of the last one,
// or — where this domain has never been measured — no number at all and one
// written line naming the date the first measurement is due. The dot is
// decoration and carries no meaning of its own, so it is `aria-hidden`.
import type React from "react";
import { formatDate } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";
import { PROV } from "./style";

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
    <div className={DOMAIN} data-testid="shell-domain">
      <p className={DOMAIN_NAME}>
        <span className={DOT} aria-hidden="true" />
        {/* A domain is a URL-shaped value, so it takes the numeral face. */}
        <span className="num">{shell.domain}</span>
      </p>
      {line === null ? null : (
        <p className={PROV} data-testid="shell-domain-line">
          {line}
        </p>
      )}
    </div>
  );
}

const DOMAIN = "flex min-w-0 flex-col gap-(--s-1)";
const DOMAIN_NAME = "flex min-w-0 items-center gap-(--s-2) font-bold";
const DOT = "size-(--s-2) flex-none rounded-(--r-pill) bg-primary";
