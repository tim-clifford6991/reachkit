// BUILD §5 — the subdomain label a customer chooses, decided in one place.
//
// §5's ruling of 2026-09-12: "the content is stored on ReachKit and served
// at `<label>.<customer-domain>` once the customer adds one CNAME … The
// customer chooses the label in step 3 of onboarding." Until that ruling
// the label was one pinned word (`HOSTED_SUBDOMAIN_LABEL`, still the
// default a customer is shown); this module is what makes it a choice
// without letting the choice widen into something a DNS name cannot hold.
//
// **Pure, and the whole rule is here.** Checking a label is a string
// question — is this a hostname label — and answering it in the browser,
// in the submit and in the availability lookup would otherwise be three
// answers that can disagree about the same typed word. The one question
// this module cannot answer is whether somebody else already holds the
// host; that is a row, and `hostname.ts` reads it.
//
// **Two refusals and no third**, because §5 names two: a label that is not
// one, and a label already taken. Neither carries a reason a customer has
// to interpret — each selects one written line.
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";

/** The label a customer who chooses nothing gets, and the one the record
 *  is drawn with before they touch the field. §5: "a subdomain label the
 *  customer chooses (default `content`)". */
export const DEFAULT_HOSTED_LABEL: string = HOSTED_SUBDOMAIN_LABEL;

/** RFC 1123 §2.1: a label is 1–63 characters. Not a product pin — it is
 *  what a DNS label is — so it lives beside the rule that reads it rather
 *  than in `constants.ts` with the caps and cadences. */
const MAX_LABEL_LENGTH = 63;

/** One label: letters, digits and inner hyphens, never a leading or
 *  trailing one. No dot: `blog.news` is two labels, and a customer who
 *  types one has not chosen a subdomain of their domain. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** What a customer can be told about a label they typed. Two members, and
 *  each is a written line at the surface — never a technical reason. */
export type LabelRefusal = "not_a_label" | "taken";

export type LabelCheck = { ok: true; label: string } | { ok: false; because: LabelRefusal };

/** The typed word as a label would be written: trimmed, lower-cased, and
 *  with a trailing dot removed. A hostname is case-insensitive, so the
 *  customer typing `Blog` and the customer typing `blog` have chosen the
 *  same host — and the uniqueness check below has to see that. */
export function normaliseLabel(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Whether this is a label at all.
 *
 * `taken` is never returned here: this function reads no row, and a
 * function that answered "taken" from a string would be guessing. The
 * caller that holds the rows composes the two.
 */
export function checkLabel(raw: string): LabelCheck {
  const label = normaliseLabel(raw);
  if (label.length === 0 || label.length > MAX_LABEL_LENGTH) {
    return { ok: false, because: "not_a_label" };
  }
  if (!LABEL.test(label)) return { ok: false, because: "not_a_label" };
  return { ok: true, label };
}

/**
 * The host a customer points at us: `<label>.<their domain>`.
 *
 * The one composer of a hosted host since the label became a choice —
 * `address.ts` calls it and nothing else composes the pair, so the record
 * shown at setup, the address a page is published at, the host the edge
 * matches and the name the domain is added to Vercel under are one string
 * written once.
 *
 * A blank or unusable label falls back to the default rather than
 * composing `.example.com`: every caller here has already checked, and a
 * host with an empty first label is not a host any of them could use.
 */
export function hostFor(a: { label: string | null; domain: string }): string {
  const checked = a.label === null ? null : checkLabel(a.label);
  const label = checked !== null && checked.ok ? checked.label : DEFAULT_HOSTED_LABEL;
  return `${label}.${a.domain}`;
}
