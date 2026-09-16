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

export function CnameRecord(p: { record: DnsRecord }): React.JSX.Element {
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
        <span className="badge badge-warning badge-soft" data-testid="dns-state">
          {copy("settings.destination.hostname.waiting")}
        </span>
      </span>
    </>
  );
}
