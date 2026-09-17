// SPEC §5 — the line under the CNAME record that says where to add it
// (issue 760; owner ruling 2026-09-16), as the shared record block draws it
// on `/setup` and in Settings.
//
// **Three answers stay three.** A provider the nameservers name is named; a
// nameserver no row of the table knows is named as itself; and where nothing
// could be looked up — or the lookup has not answered yet — the founder reads
// the static line #759 wrote. The Cloudflare line is shown only when the
// provider is Cloudflare.
//
// **The record never waits for this.** The block renders with the static
// line, and the answer replaces it when it arrives; a lookup that throws
// is the static line, and one that hangs leaves it on screen.
//
// Spans only: on `/setup` the record sits inside the hosted option's button.
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { copy } from "@/lib/presentation/copy";
import type { DnsWhere as Where } from "@/lib/publish/destinations/hosted/dns-provider";
import { whereDnsIs } from "./dns-actions";

const LINE = "mt-2 block text-sm text-base-content/70";
const UNKNOWN: Where = { kind: "unknown" };

export function DnsWhere(p: {
  /** The site address the record sits under — asked about once per
   *  address, not once per label typed. */
  domain: string;
}): React.JSX.Element {
  const [answer, setAnswer] = useState<{ domain: string; where: Where } | null>(null);

  useEffect(() => {
    let current = true;
    whereDnsIs({ domain: p.domain })
      .catch((): Where => UNKNOWN)
      .then((where) => {
        if (current) setAnswer({ domain: p.domain, where });
      });
    return () => {
      current = false;
    };
  }, [p.domain]);

  // An answer about another address is no answer about this one.
  const where = answer !== null && answer.domain === p.domain ? answer.where : UNKNOWN;

  switch (where.kind) {
    case "provider":
      return (
        <>
          <span className={LINE} data-testid="dns-where" data-where={where.kind}>
            {copy("setup.destination.dnsAt", { provider: where.provider })}
          </span>
          {where.cloudflare ? (
            <span className="mt-1 block text-sm text-base-content/70" data-testid="dns-proxy">
              {copy("setup.destination.dnsProxy")}
            </span>
          ) : null}
        </>
      );
    case "nameserver":
      return (
        <span className={LINE} data-testid="dns-where" data-where={where.kind}>
          {copy("setup.destination.dnsNameserver", { nameserver: where.nameserver })}
        </span>
      );
    case "unknown":
      return (
        <span className={LINE} data-testid="dns-where" data-where={where.kind}>
          {copy("setup.destination.dnsWhere")}
        </span>
      );
  }
}
