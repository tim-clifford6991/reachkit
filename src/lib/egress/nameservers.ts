// src/lib/egress/nameservers.ts — `nameserversOf`, the NS lookup beside
// `resolvesInDns` (SPEC §5, issue 760).
//
// Where a founder's DNS is managed is named by their domain's nameservers,
// and those are one DNS question away: no vendor API, no credential, no
// cost. The answer only decorates the guidance beside the CNAME record, so
// this lookup must never be the reason that record is slow or missing:
// bounded by `DNS_TIMEOUT_MS`, the same bound `resolvesInDns` holds, and
// every failure — no such zone, no NS records, a resolver error, a hang —
// is the one `null` a caller reads as "could not look it up".
//
// Never throws; never opens a socket to the domain itself.
import dns from "node:dns";
import { DNS_TIMEOUT_MS } from "@/lib/config/constants";

/** The nameservers `domain` is delegated to, lowercased and without the
 *  trailing dot, in the resolver's order — or `null` where there is no
 *  answer to give. `domain` is a bare zone name, never a URL. */
export async function nameserversOf(domain: string): Promise<readonly string[] | null> {
  const name = domain.trim().toLowerCase().replace(/\.+$/, "");
  if (name === "") return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DNS_TIMEOUT_MS);
  });
  // Started inside a promise, so a resolver that throws before it returns
  // one is a failed lookup like any other.
  const lookup = Promise.resolve()
    .then(() => dns.promises.resolveNs(name))
    .then((records): readonly string[] | null => {
      const servers = records.map((r) => r.trim().toLowerCase().replace(/\.+$/, "")).filter((r) => r !== "");
      return servers.length === 0 ? null : servers;
    })
    .catch((): null => null);

  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
