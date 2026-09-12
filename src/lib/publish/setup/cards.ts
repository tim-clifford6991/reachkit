// BUILD §4.3 · SPEC §7 — the destination cards' data.
//
// "destination: *Hosted blog* (chosen, shows the CNAME record) vs
// *WordPress — connect later, ask me after the first page*." (§4.3). The
// mode pair that stood beside it went with §7 (2026-09-11): Autopilot is
// the only mode, so setup offers no choice of one.
//
// The archived plan is WO-221. Three properties this module exists to make
// structural rather than reviewable:
//
//  1. **Both defaults are data on the option**, not a fallback applied when
//     a field is missing — so a submit carrying no explicit choice records
//     the value the founder was shown, and the screen and the writer cannot
//     disagree about what "default" meant.
//  2. **`dns` has exactly two shapes** — the record, or the stated pending
//     shape — and no third. There is no `null`, no empty string and no
//     placeholder, so no surface can render a blank where a value would
//     sit (REQ-028 c2).
//  3. **Every option carries a copy key and this module writes no
//     sentence.** The destination *names* are §4.3's own words, already in
//     the registry; the one written line each option states is its own key.
//
// Pure: no network call, no health check, no clock. The edge hostname the
// record points at is an env binding and is passed in by the adapter —
// never a string in a card, and never a read this module makes, which is
// what keeps its whole contract decidable in a unit test.
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";

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
}

export interface SetupCards {
  destination: readonly DestinationOption[];
}

/** §9's `content.{customer-domain}` CNAME, or the stated pending shape
 *  where no site address has been given yet. */
export function dnsRecordFor(a: {
  siteDomain: string | null;
  cnameTarget: string;
}): DnsRecord | DnsPending {
  if (a.siteDomain === null) {
    return { pending: "no_domain_yet", copy: "setup.destination.dnsPending" };
  }
  return {
    type: "CNAME",
    name: `${HOSTED_SUBDOMAIN_LABEL}.${a.siteDomain}`,
    value: a.cnameTarget,
  };
}

/** Both destination options, every time, with the pre-selection carried as
 *  data on the option. */
export function setupCards(a: { siteDomain: string | null; cnameTarget: string }): SetupCards {
  return {
    destination: Object.freeze([
      Object.freeze({
        kind: "hosted" as const,
        preselected: true,
        name: "setup.destination.hosted.name" as const,
        copy: "setup.destination.hosted" as const,
        dns: dnsRecordFor(a),
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

/** The destination a founder who touched no card submits — read off the
 *  cards themselves, so "the value the founder was shown" and "the value
 *  recorded" are the same fact read twice, never two constants. */
export function preselected(cards: SetupCards): { destination: DestinationKind } {
  const destination = cards.destination.find((option) => option.preselected);
  if (!destination) {
    throw new Error("src/lib/publish/setup/cards.ts: every card pair must carry one pre-selection.");
  }
  return { destination: destination.kind };
}
