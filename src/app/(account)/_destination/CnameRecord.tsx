// SPEC §5 — the one CNAME a founder creates for the hosted blog, as both
// screens that show it render it: `/setup`, where it is first shown, and
// Settings, where a destination still waiting for DNS shows it again (#754).
//
// One block, so the two screens cannot drift: the record is `dnsRecordFor()`'s
// and the words are the registry's. Spans only, because setup draws it inside
// the hosted option's button.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import type { DnsRecord } from "@/lib/publish/setup/cards";
import type { HostnameState } from "@/lib/publish/destinations/hosted/hostname";
import { DnsWhere } from "./DnsWhere";

/** The site address a record sits under: its name less the label.
 *  `hostFor` composes every record name as `<label>.<address>`, and a label
 *  holds no dot. */
function addressOf(name: string): string {
  return name.slice(name.indexOf(".") + 1);
}

export function CnameRecord(p: {
  record: DnsRecord;
  /** The domain list's word for the host, where a "check connection" press
   *  on `/setup` has just asked it (#757). Absent is "waiting for DNS" — the
   *  word a record nobody has checked is shown under. */
  state?: HostnameState;
}): React.JSX.Element {
  const live = p.state === "live";
  return (
    <>
      <span className="mt-2 block text-sm text-base-content/70" data-testid="dns-caption">
        {copy("setup.destination.dnsRecord")}
      </span>
      {/* The hostname is `waiting` until the customer creates the record
          they are being shown; settings reads the same word back. */}
      <span className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3">
        <span className="num flex min-w-0 flex-wrap gap-2 text-sm" data-testid="dns-record">
          <span className="min-w-0 wrap-anywhere" data-testid="dns-name">
            {p.record.name}
          </span>
          <span className="min-w-0 wrap-anywhere" data-testid="dns-type">
            {p.record.type}
          </span>
          <span className="min-w-0 wrap-anywhere" data-testid="dns-value">
            {p.record.value}
          </span>
        </span>
        <span
          className={live ? "badge badge-success badge-soft" : "badge badge-warning badge-soft"}
          data-testid="dns-state"
        >
          {copy(live ? "settings.destination.hostname.live" : "settings.destination.hostname.waiting")}
        </span>
      </span>
      {/* Where the record is added, from the domain's nameservers
          (issue 760) — the static line until, or unless, they answer. */}
      <DnsWhere domain={addressOf(p.record.name)} />
    </>
  );
}
