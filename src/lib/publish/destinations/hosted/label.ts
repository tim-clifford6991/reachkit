// BUILD §5 — the subdomain label a customer chooses in onboarding step 3, served at `<label>.<customer-domain>` by one CNAME.
// Pure, and the whole rule is here, so the browser, the submit and the availability lookup cannot disagree about one word;
// whether another site holds the host is a row, read by `hostname.ts`.
// Two refusals, as §5 names two: not a label, and taken. Each selects one written line, never a reason to interpret.
import { HOSTED_SUBDOMAIN_LABEL } from "@/lib/config/constants";

/** §5: "a subdomain label the customer chooses (default `content`)"; the record is drawn with it until they choose. */
export const DEFAULT_HOSTED_LABEL: string = HOSTED_SUBDOMAIN_LABEL;

/** RFC 1123 §2.1: a label is 1–63 characters; what a DNS label is, not a product pin, so not in `constants.ts`. */
const MAX_LABEL_LENGTH = 63;

/** Letters, digits and inner hyphens. No dot: `blog.news` is two labels, not a subdomain of their domain. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** What a customer can be told about a typed label; each member is a written line, never a technical reason. */
export type LabelRefusal = "not_a_label" | "taken";

export type LabelCheck = { ok: true; label: string } | { ok: false; because: LabelRefusal };

/** Trimmed, lower-cased, trailing dot removed: `Blog` and `blog` are one host, and the uniqueness check must see that. */
export function normaliseLabel(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

/** Whether this is a label at all. Never `taken`: it reads no row, so the caller holding the rows composes the two. */
export function checkLabel(raw: string): LabelCheck {
  const label = normaliseLabel(raw);
  if (label.length === 0 || label.length > MAX_LABEL_LENGTH) {
    return { ok: false, because: "not_a_label" };
  }
  if (!LABEL.test(label)) return { ok: false, because: "not_a_label" };
  return { ok: true, label };
}

/** The one composer of a hosted host, `<label>.<their domain>`, so the setup record, the page address, the edge match
 *  and the Vercel domain are one string. An unusable label falls back to the default, never `.example.com`. */
export function hostFor(a: { label: string | null; domain: string }): string {
  const checked = a.label === null ? null : checkLabel(a.label);
  const label = checked !== null && checked.ok ? checked.label : DEFAULT_HOSTED_LABEL;
  return `${label}.${a.domain}`;
}

/** Another site claimed the host between check and commit, and `destinations_one_live_hostname` refused the write.
 *  `applySetupChoice` throws it so the submit answers `label_taken`, not a 500; declared here so `submit.ts` reads no row. */
export class HostnameTakenError extends Error {
  constructor(readonly hostname: string) {
    super(`hostname taken: ${hostname}`);
    this.name = "HostnameTakenError";
  }
}
