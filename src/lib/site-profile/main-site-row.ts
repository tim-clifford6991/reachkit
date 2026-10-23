// SPEC §7 (2026-10-18, issue 1511) — `site_profiles.main_site`, the shape
// the scan stores (`./main-site.ts`) and the hosted pages read.
//
// A leaf with no imports: the hosted store reads it, and that store is
// reached from the middleware's bundle.

/** Whether the main site's own pages link the content host. */
export type MainSiteLink = "linked" | "not_followed" | "not_linked";

/** The kinds of page a hosted page's about card links on the main site. */
export const MAIN_SITE_ACTIONS = ["book", "quote"] as const;
export type MainSiteActionKind = (typeof MAIN_SITE_ACTIONS)[number];

/** What a book page books, read off its own address and words. */
export const BOOK_KINDS = ["demo", "call", "visit"] as const;
export type BookKind = (typeof BOOK_KINDS)[number];

/** A book or quote page of the main site; a book page says what it books,
 *  except on a reading stored before. */
export interface MainSiteAction {
  kind: MainSiteActionKind;
  url: string;
  book?: BookKind;
}

export interface MainSite {
  /** The main site's canonical home. */
  home: string;
  /** What the main site's own Organization markup declares, each `null`
   *  where it declares none. */
  organization: { id: string | null; name: string | null; logo: string | null };
  /** The profile pages the main site itself links to. */
  sameAs: readonly string[];
  /** Issue 1509: the main site's own about and team pages, each with its
   *  visible text and the profile pages it links — where a page's author is
   *  named, if anywhere. Empty on a reading stored before. */
  aboutPages: readonly AboutPage[];
  /** Per content host ReachKit serves for this domain (without `www.`):
   *  whether the main site's own pages link it. Empty where the domain has
   *  none, or where which pages are ours could not be read. */
  links: readonly { host: string; state: MainSiteLink }[];
  /** The book and quote pages the home's own header or nav links, on the
   *  business's own site, at most one of each and never two at one address.
   *  Empty where it links none, or on a reading stored before. */
  actions: readonly MainSiteAction[];
  /** The phone number the main site states, as it writes it: its
   *  Organization's `telephone`, else its home's first `tel:` link. `null`
   *  where it states none, or on a reading stored before. */
  phone: string | null;
}

/** One about or team page of the main site, as the scan read it. */
export interface AboutPage {
  url: string;
  /** Its visible text, cut to `SITE_PROFILE.ABOUT_TEXT_CHARS`. */
  text: string;
  /** The profile pages it links. */
  profiles: readonly string[];
}

function isHttp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A stored `main_site` value, read back as what of it still parses. */
export function mainSiteOf(value: unknown): MainSite | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (!isHttp(row.home)) return null;
  const organization = (typeof row.organization === "object" && row.organization !== null ? row.organization : {}) as Record<string, unknown>;
  const text = (entry: unknown): string | null => (typeof entry === "string" && entry.trim() !== "" ? entry : null);
  const states: readonly MainSiteLink[] = ["linked", "not_followed", "not_linked"];
  return {
    home: row.home,
    organization: { id: text(organization.id), name: text(organization.name), logo: text(organization.logo) },
    sameAs: Array.isArray(row.sameAs) ? row.sameAs.filter((entry): entry is string => isHttp(entry)) : [],
    aboutPages: Array.isArray(row.aboutPages)
      ? row.aboutPages.flatMap((entry) => {
          const page = entry as Record<string, unknown> | null;
          if (!isHttp(page?.url) || typeof page.text !== "string") return [];
          const profiles = Array.isArray(page.profiles) ? page.profiles.filter((each): each is string => isHttp(each)) : [];
          return [{ url: page.url, text: page.text, profiles }];
        })
      : [],
    links: Array.isArray(row.links)
      ? row.links.flatMap((entry) => {
          const link = entry as Record<string, unknown> | null;
          return typeof link?.host === "string" && states.includes(link.state as MainSiteLink)
            ? [{ host: link.host, state: link.state as MainSiteLink }]
            : [];
        })
      : [],
    actions: Array.isArray(row.actions)
      ? row.actions.flatMap((entry) => {
          const action = entry as Record<string, unknown> | null;
          if (!isHttp(action?.url) || !MAIN_SITE_ACTIONS.includes(action.kind as MainSiteActionKind)) return [];
          const book = action.kind === "book" && BOOK_KINDS.includes(action.book as BookKind) ? { book: action.book as BookKind } : {};
          return [{ kind: action.kind as MainSiteActionKind, url: action.url, ...book }];
        })
      : [],
    phone: phoneOf(row.phone),
  };
}

/** A number as a page may show it: digits with the usual separators, and
 *  at least six digits, so a stored word is never drawn as a phone. */
export function phoneOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const phone = value.replace(/\s+/g, " ").trim();
  return /^\+?[\d ()./-]{6,30}$/.test(phone) && (phone.match(/\d/g) ?? []).length >= 6 ? phone : null;
}
