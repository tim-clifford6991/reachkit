// SPEC §5 (2026-09-20) — Overview while the customer's address waits for its
// DNS record: the one setting, where it is added, and the check.
//
// The record, its steps and the provider lookup are `CnameRecord`'s and the
// check is `CheckConnection`'s, the same blocks setup's connect step and
// Settings draw, so no screen states a second record for one host.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CheckConnection } from "../../_destination/CheckConnection";
import { CnameRecord } from "../../_destination/CnameRecord";
import type { AddressWaiting } from "./model";

export function ConnectAddress(p: { connect: AddressWaiting }): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-connect">
      <div className="card-body min-w-0 gap-4 p-4 sm:p-5">
        <p className="eyebrow">{copy("overview.connect.eyebrow")}</p>
        <h2 className="card-title">{copy("overview.connect.title")}</h2>
        <p className="max-w-prose text-sm text-base-content/70 wrap-anywhere">
          {copy("overview.connect.line", { host: p.connect.hostname })}
        </p>
        <CnameRecord record={p.connect.record} />
        <CheckConnection draft={null} />
      </div>
    </section>
  );
}
