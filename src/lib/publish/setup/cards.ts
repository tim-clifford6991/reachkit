// SPEC §5 — the destination cards' data: *Hosted* (chosen, shows the CNAME record) vs *WordPress — connect later*.
// No mode pair (SPEC §7): Autopilot is the only mode; `PublishingMode` stays because the machine reads `sites.mode`.
// The default is data on the option, so a submit with no choice records what the founder was shown.
// `dns` has exactly two shapes, the record or the stated pending one, never a blank (REQ-028 c2).
// Every option carries a copy key and this module writes no sentence. Pure: the edge hostname is passed in.
import type { CopyKey } from "@/lib/presentation/copy";
import { DEFAULT_HOSTED_LABEL, hostFor } from "../destinations/hosted/label";

export type PublishingMode = "autopilot";
export type DestinationKind = "hosted" | "wordpress";

/** The one record a founder points at the hosted blog: `name` is their host, `value` what it points at. */
export interface DnsRecord {
  type: "CNAME";
  name: string;
  value: string;
}

/** REQ-028 c2's written line, as a shape rather than an absence. */
export interface DnsPending {
  pending: "no_domain_yet";
  copy: "setup.destination.dnsPending";
}

export interface DestinationOption {
  kind: DestinationKind;
  /** Hosted true, wordpress false — §4.3's "*Hosted blog* (chosen…)". */
  preselected: boolean;
  name: CopyKey;
  copy: "setup.destination.hosted" | "setup.destination.wordpress";
  /** Present only for `hosted`. Two shapes, never a blank (REQ-028 c2). */
  dns?: DnsRecord | DnsPending;
  /** The label the record is composed with, chosen or default (SPEC §5); `hosted` only. */
  label?: string;
}

export interface SetupCards {
  destination: readonly DestinationOption[];
}

/** The record a host waiting for DNS still needs, composed from the host, so setup, Settings and Overview state one
 *  record. A host the record would not name exactly gets none rather than a different one. */
export function recordForHost(a: {
  hostname: string;
  cnameTarget: string;
}): DnsRecord | null {
  const dot = a.hostname.indexOf(".");
  if (dot === -1) return null;
  const record = dnsRecordFor({
    siteDomain: a.hostname.slice(dot + 1),
    cnameTarget: a.cnameTarget,
    label: a.hostname.slice(0, dot),
  });
  return "pending" in record || record.name !== a.hostname ? null : record;
}

/** The `<label>.{customer-domain}` CNAME (SPEC §5), or the pending shape with no site address yet. The label follows
 *  the field being typed; `null` is the default. */
export function dnsRecordFor(a: {
  siteDomain: string | null;
  cnameTarget: string;
  label?: string | null;
}): DnsRecord | DnsPending {
  if (a.siteDomain === null) {
    return { pending: "no_domain_yet", copy: "setup.destination.dnsPending" };
  }
  return {
    type: "CNAME",
    name: hostFor({ label: a.label ?? null, domain: a.siteDomain }),
    value: a.cnameTarget,
  };
}

/** Both options, every time, with the pre-selection as data. */
export function setupCards(a: {
  siteDomain: string | null;
  cnameTarget: string;
  /** The chosen label, or absent for the default (SPEC §5: "default `content`"). */
  label?: string | null;
}): SetupCards {
  const label = a.label ?? DEFAULT_HOSTED_LABEL;
  return {
    destination: Object.freeze([
      Object.freeze({
        kind: "hosted" as const,
        preselected: true,
        name: "setup.destination.hosted.name" as const,
        copy: "setup.destination.hosted" as const,
        dns: dnsRecordFor({ ...a, label }),
        label,
      }),
      Object.freeze({
        kind: "wordpress" as const,
        preselected: false,
        name: "setup.destination.wordpress.name" as const,
        copy: "setup.destination.wordpress" as const,
      }),
    ]),
  };
}

/** What a founder who touched neither card submits, read off the cards, so shown and recorded are one fact. */
export function preselected(cards: SetupCards): { destination: DestinationKind } {
  const destination = cards.destination.find((option) => option.preselected);
  if (!destination) {
    throw new Error("src/lib/publish/setup/cards.ts: the destination pair must carry one pre-selection.");
  }
  return { destination: destination.kind };
}
