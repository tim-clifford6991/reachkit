// SPEC §5 — the destination cards' data: *Hosted* (chosen, shows the CNAME
// record) vs *WordPress — connect later*.
//
// **No mode pair** (SPEC §7, 2026-09-11; #476): Autopilot is the only mode
// and no screen offers a choice. `PublishingMode` stays because the publish
// machine still reads `sites.mode`; setup always records `autopilot`.
//
// The archived plan is WO-221. Three properties this module exists to make
// structural rather than reviewable:
//
//  1. **The default is data on the option**, not a fallback applied when
//     a field is missing — so a submit carrying no explicit choice records
//     the value the founder was shown, and the screen and the writer cannot
//     disagree about what "default" meant.
//  2. **`dns` has exactly two shapes** — the record, or the stated pending
//     shape — and no third. There is no `null`, no empty string and no
//     placeholder, so no surface can render a blank where a value would
//     sit (REQ-028 c2).
//  3. **Every option carries a copy key and this module writes no
//     sentence.** The destination names are already in the registry; the
//     one written line each option states is its own key.
//
// Pure: no network call, no health check, no clock. The edge hostname the
// record points at is an env binding and is passed in by the adapter —
// never a string in a card, and never a read this module makes, which is
// what keeps its whole contract decidable in a unit test.
import type { CopyKey } from "@/lib/presentation/copy";
import { DEFAULT_HOSTED_LABEL, hostFor } from "../destinations/hosted/label";

export type PublishingMode = "autopilot" | "copilot";
export type DestinationKind = "hosted" | "wordpress";

/** The one record a founder points at the hosted blog. `name` is the host
 *  they create it on; `value` is what it points at. */
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
  /** The subdomain label the record above is composed with — the
   *  customer's own choice, or the default they have not changed (SPEC §5,
   *  2026-09-12). Present only for `hosted`, like the record itself. */
  label?: string;
}

export interface SetupCards {
  destination: readonly DestinationOption[];
}

/** The `<label>.{customer-domain}` CNAME (SPEC §5, 2026-09-12), or the
 *  stated pending shape where no site address has been given yet.
 *
 *  **The label travels with the field the customer is typing in**, so the
 *  record under the card always names the host they have chosen rather
 *  than the one they started on. `null` is the default label, which is
 *  what the card is drawn with before they touch it. */
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

/** Both destination options, every time, with the pre-selection carried as
 *  data on the option. */
export function setupCards(a: {
  siteDomain: string | null;
  cnameTarget: string;
  /** The label the founder has chosen, or absent for the default they are
   *  shown before they choose one (SPEC §5: "default `content`"). */
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

/** The destination a founder who touched neither card submits — read off
 *  the cards themselves, so "the value the founder was shown" and "the value
 *  recorded" are the same fact read twice, never two constants. */
export function preselected(cards: SetupCards): { destination: DestinationKind } {
  const destination = cards.destination.find((option) => option.preselected);
  if (!destination) {
    throw new Error("src/lib/publish/setup/cards.ts: the destination pair must carry one pre-selection.");
  }
  return { destination: destination.kind };
}
