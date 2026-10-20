// src/lib/business/understanding.ts — what ReachKit understands of one
// business, read one way for every surface (issue 1454).
//
// A business was read three times: the free scan's profile
// (`scans.report` → `market.value.profile`), the paid pass's market
// (`sites.market`) and the customer's own edits (`site_profile_edits`).
// Nothing compared them, and the audit of 2026-10-15
// (`docs/walk/business/2026-10-15.md`) found that, for every site read both
// ways, they disagreed on what it sells, who buys and where. This function
// is the one reading: the free report, the app's overview and Settings ask
// it, so they say the same thing.
//
// Precedence, per field. The customer's word first. Then the paid pass's
// market, which reads the whole site and is re-checked every week. Then the
// profile the scan read from the home page. A field nothing states is
// absent, never guessed.
//
// Pure: no I/O, no clock. Server-side only: the name rule reads `node:url`.
import type { Locale } from "@/lib/locale/locales";
import { isBusinessKind } from "@/lib/market/kinds";
import type { StoredMarket } from "@/lib/market/infer/types";
import type { Offering, Profile, Reach } from "@/lib/market/questions/profile-types";
import type { BusinessUnderstanding, UnderstandingEdits } from "./types";

export type { BusinessUnderstanding, UnderstandingEdits };
import { offeringsOf } from "@/lib/market/questions/offerings";
import { profileTown } from "@/lib/market/rivals/reach";
import { brandName, domainBrand } from "@/lib/site-profile/site-name";
import { isProtectionName } from "@/lib/measure/challenge";
import { isPlaceholder, withoutPlaceholders } from "@/lib/measure/placeholder";

export function understandBusiness(a: {
  domain: string;
  /** `site_profiles.site_name`, where the crawl stored one. The name is
   *  read from it, then from the profile's first brand token, by the name
   *  rule of issues 1380 and 1384; else it is the domain's own label. */
  storedName?: string | null;
  /** The profile the latest scan read; `null` where none was read. */
  profile: Profile | null;
  /** Where the latest scan measured. */
  locale: Locale;
  /** How many other markets the newest pass read the site declares. */
  alsoServes?: number;
  /** A paying site's stored market and its confirmed category. */
  market?: StoredMarket | null;
  category?: string | null;
  edits?: UnderstandingEdits | null;
}): BusinessUnderstanding {
  const profile = a.profile;
  const current = a.market?.current ?? null;
  const edits = a.edits ?? {};

  // What it sells: the profile's lines, the first named as the market in
  // force names it (the customer's category, else the paid pass's).
  const confirmed = a.market?.categoryOverridden === true ? (a.category ?? "").trim() : "";
  const lead = confirmed !== "" ? confirmed : (current?.category ?? "").trim();
  const lines = profile === null ? [] : offeringsOf(profile);
  const sells = lead === "" ? lines : withLead(lead, lines);

  const removed = new Set((edits.removed?.audienceTerms ?? []).map(key));
  const terms = [...(profile?.audienceTerms ?? []), ...(edits.added?.audienceTerms ?? [])].filter((t) => !removed.has(key(t)));
  const said = (edits.buyers ?? "").trim();
  const concluded = (current?.buyer ?? "").trim();
  const buyers = said !== "" ? [said] : concluded !== "" ? [concluded] : unique(terms);

  // Where: a place the customer gave or a pass read stands; then the place
  // the scan measured in; then the profile's reach and town.
  const area = a.market?.area;
  const servedPlace = area !== undefined ? area.place : current?.serves ?? null;
  const town = (profile === null ? undefined : profileTown(profile)) ?? "";
  const place = servedPlace ?? a.locale.place ?? (town === "" ? null : { name: town });
  const reach: Reach | null =
    place !== null ? "local" : area !== undefined || current?.serves === null ? nonLocal(profile?.reach) : profile?.reach ?? null;

  const kind = current?.kind ?? profile?.kind ?? null;
  const job = (edits.job ?? "").trim() || (current?.job ?? "").trim() || (profile?.job ?? "").trim() || null;

  return {
    name: brandName([a.storedName, profile?.brandTokens[0]], a.domain) ?? domainBrand(a.domain),
    job,
    sells,
    buyers,
    where: { reach, place, country: a.locale.country, ...(a.alsoServes === undefined || a.alsoServes === 0 ? {} : { alsoServes: a.alsoServes }) },
    kind: isBusinessKind(kind) ? kind : null,
    language: a.locale.language,
  };
}

/** A paid pass that settled no place read a business that sells across a
 *  country or online: the profile says which, else it is national. */
function nonLocal(reach: Reach | undefined): Reach {
  return reach === "international" ? "international" : "national";
}

function withLead(lead: string, lines: readonly Offering[]): Offering[] {
  if (lines.length === 0) return [{ name: lead, category: lead, weight: 1 }];
  const [first, ...rest] = lines;
  return [{ ...first!, category: lead }, ...rest.filter((o) => key(o.category) !== key(lead))];
}

function key(text: string): string {
  return text.trim().toLowerCase();
}

function unique(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const text of texts.map((t) => t.trim())) {
    if (text !== "" && !out.some((held) => key(held) === key(text))) out.push(text);
  }
  return out;
}

/** The profile a stored report carries, or `null`, with what names nothing
 *  taken out. Read defensively: a
 *  report written before the market carried its profile, or one whose
 *  market was never read, has none, and that is never a reason for a
 *  screen to fail. */
export function profileOfReport(report: unknown): Profile | null {
  if (typeof report !== "object" || report === null) return null;
  const market = (report as { market?: unknown }).market;
  if (typeof market !== "object" || market === null) return null;
  const { kind, value } = market as { kind?: unknown; value?: unknown };
  if ((kind !== "measured" && kind !== "zero") || typeof value !== "object" || value === null) return null;
  const profile = (value as { profile?: unknown }).profile;
  if (typeof profile !== "object" || profile === null) return null;
  const { category, job, audienceTerms, brandTokens } = profile as Record<string, unknown>;
  const strings = (list: unknown): boolean => Array.isArray(list) && list.every((item) => typeof item === "string");
  if (typeof category !== "string" || typeof job !== "string" || !strings(audienceTerms) || !strings(brandTokens)) return null;
  // A field stored as a placeholder or a protection page's words names
  // nothing, so it is read as none and never shown (issue 1479).
  const domain = (report as { domain?: unknown }).domain;
  return withoutPlaceholders(profile as Profile, (text) => isPlaceholder(text) || (typeof domain === "string" && isProtectionName(text, domain)));
}

/**
 * The profile a paying site's searches are chosen by: the one the scan read,
 * with the customer's own corrections over it (issue 1454). A buyer term or
 * a word they took out is not a relevance term any more, one they added is,
 * and their wording of what the business does replaces the model's.
 */
export function profileWithEdits(
  profile: Profile,
  edits: Pick<UnderstandingEdits, "job" | "added" | "removed">
): Profile {
  const edit = (list: readonly string[], field: "audienceTerms" | "vocabulary"): string[] => {
    const removed = new Set((edits.removed?.[field] ?? []).map(key));
    return unique([...list, ...(edits.added?.[field] ?? [])].filter((t) => !removed.has(key(t))));
  };
  const job = (edits.job ?? "").trim();
  return {
    ...profile,
    job: job === "" ? profile.job : job,
    audienceTerms: edit(profile.audienceTerms, "audienceTerms"),
    vocabulary: edit(profile.vocabulary, "vocabulary"),
  };
}
