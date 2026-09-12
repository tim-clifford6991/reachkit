// tests/site-profile/store.test.ts — issue #577, SPEC.md §5 done-when:
// "the weekly pass refreshes the profile; a customer edit to the voice is
// not overwritten by a refresh".
//
// The behaviour a customer can observe: they edit the voice ReachKit read
// off their site, a later pass re-reads the site, and what they wrote is
// still what the product holds.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

type Row = Record<string, unknown>;

/** A stand-in for the two PostgREST calls this module makes: it holds
 *  rows, applies the filters it is given — `is("voice_edited_at", null)`
 *  included, which is the whole guard under test — and answers with what
 *  matched, so a statement that filters wrongly fails here the way it
 *  would fail against Postgres. */
function fakeProfileDb(tables: Record<string, Row[]>) {
  return {
    tables,
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let updates: Row | null = null;
      let upserted: { values: Row; onConflict: string } | null = null;

      const rows = (): Row[] => (tables[table] ??= []);
      const matched = (): Row[] => rows().filter((row) => filters.every((f) => f(row)));

      const self = {
        select: () => self,
        update(values: Row) {
          updates = values;
          return self;
        },
        upsert(values: Row, options: { onConflict: string }) {
          upserted = { values, onConflict: options.onConflict };
          return self;
        },
        insert(values: Row) {
          rows().push(values);
          return self;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return self;
        },
        is(column: string, value: unknown) {
          filters.push((row) => (row[column] ?? null) === value);
          return self;
        },
        limit: () => self,
        then(resolve: (v: { data: Row[]; error: null }) => unknown) {
          if (upserted !== null) {
            const key = upserted.onConflict;
            const values = upserted.values;
            const existing = rows().find((row) => row[key] === values[key]);
            if (existing === undefined) rows().push({ ...values });
            else Object.assign(existing, values);
            return Promise.resolve({ data: [values], error: null }).then(resolve);
          }
          const hit = matched();
          if (updates !== null) for (const row of hit) Object.assign(row, updates);
          return Promise.resolve({ data: hit, error: null }).then(resolve);
        },
      };
      return self;
    },
  };
}

let db = fakeProfileDb({});

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db as unknown,
  db: () => db as unknown,
}));

const { adoptVoiceText, readSiteProfile, saveVoiceText, writeSiteProfile } = await import(
  "../../src/lib/site-profile/store"
);

const DOMAIN = "example.com";
const SITE = "site-1";

const VOICE = {
  text: "Plain and direct, second person, short sentences.",
  tone: "plain",
  person: "second",
  vocabulary: ["payouts"],
  claimsToKeep: ["SEPA-native since 2019"],
  claimsToAvoid: ["the leading"],
};

function profileRow(overrides: Row = {}): Row {
  return {
    domain: DOMAIN,
    site_name: "Example Payments",
    products: ["payments"],
    claims: ["SEPA-native since 2019"],
    voice: VOICE,
    inventory: [{ url: `https://${DOMAIN}/pricing`, title: "Pricing", h1: "Pricing", purpose: "pricing" }],
    pages_read: 1,
    refreshed_at: "2026-09-12T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  db = fakeProfileDb({});
});

describe("the stored profile is what the screens read", () => {
  it("reads back the inventory, the name, the products and the voice", async () => {
    db = fakeProfileDb({ site_profiles: [profileRow()] });

    const profile = await readSiteProfile(DOMAIN);

    expect(profile?.siteName).toBe("Example Payments");
    expect(profile?.pagesRead).toBe(1);
    expect(profile?.inventory[0]?.purpose).toBe("pricing");
    expect(profile?.voice?.claimsToAvoid).toEqual(["the leading"]);
  });

  it("answers null for a domain no pass has read", async () => {
    expect(await readSiteProfile("never-scanned.example")).toBeNull();
  });

  it("a refresh replaces the reading rather than accumulating it", async () => {
    db = fakeProfileDb({ site_profiles: [profileRow()] });

    await writeSiteProfile({
      domain: DOMAIN,
      siteName: "Example Payments",
      products: ["payments", "invoicing"],
      claims: [],
      voice: null,
      inventory: [{ url: `https://${DOMAIN}/about`, title: "About", h1: "About us", purpose: "about" }],
      pagesRead: 1,
      refreshedAt: new Date("2026-09-19T09:00:00.000Z"),
    });

    expect(db.tables.site_profiles).toHaveLength(1);
    const stored = await readSiteProfile(DOMAIN);
    // The deleted pricing page is gone from the inventory, not merged into
    // it — a link to a page that no longer exists is the defect §7 forbids.
    expect(stored?.inventory.map((row) => row.url)).toEqual([`https://${DOMAIN}/about`]);
  });

  it("a free re-scan re-reads the pages without taking away the voice a paid pass read", async () => {
    // The sequence a real customer hits: the deep pass at setup reads the
    // voice, the products and the claims; some weeks later a free scan of
    // the same domain runs — from the landing page, by anyone — and crawls
    // it again. The free pass issues no model call (issue #577), so it
    // arrives here with none of the three. Writing them as empty would
    // wipe the voice summary off the customer's own setup and settings
    // screens, which is a customer-visible loss, so the write omits those
    // columns and Postgres keeps what it already holds.
    db = fakeProfileDb({ site_profiles: [profileRow()] });

    await writeSiteProfile({
      domain: DOMAIN,
      siteName: "Example Payments",
      products: [],
      claims: [],
      voice: null,
      inventory: [
        { url: `https://${DOMAIN}/pricing`, title: "Pricing", h1: "Pricing", purpose: "pricing" },
        { url: `https://${DOMAIN}/about`, title: "About", h1: "About us", purpose: "about" },
      ],
      pagesRead: 2,
      refreshedAt: new Date("2026-09-26T09:00:00.000Z"),
    });

    const stored = await readSiteProfile(DOMAIN);
    // What the free pass read is current…
    expect(stored?.pagesRead).toBe(2);
    expect(stored?.inventory).toHaveLength(2);
    // …and what only a paid pass can read is still there.
    expect(stored?.voice?.text).toBe(VOICE.text);
    expect(stored?.products).toEqual(["payments"]);
    expect(stored?.claims).toEqual(["SEPA-native since 2019"]);
  });
});

describe("a customer edit to the voice survives every later refresh", () => {
  it("seeds the customer's field from the derived voice while they have not touched it", async () => {
    db = fakeProfileDb({
      site_profiles: [profileRow()],
      sites: [{ id: SITE, domain: DOMAIN, voice_text: null, voice_edited_at: null }],
    });

    expect(await adoptVoiceText({ siteId: SITE, domain: DOMAIN })).toBe(true);
    expect(db.tables.sites?.[0]?.voice_text).toBe(VOICE.text);
  });

  it("does not touch it once they have edited it — the stamp is the whole guard", async () => {
    db = fakeProfileDb({
      site_profiles: [profileRow()],
      sites: [
        {
          id: SITE,
          domain: DOMAIN,
          voice_text: "We say “customers”, never “users”.",
          voice_edited_at: "2026-09-13T10:00:00.000Z",
        },
      ],
    });

    expect(await adoptVoiceText({ siteId: SITE, domain: DOMAIN })).toBe(false);
    expect(db.tables.sites?.[0]?.voice_text).toBe("We say “customers”, never “users”.");
  });

  it("an edit stores the text and stamps it in the same statement", async () => {
    db = fakeProfileDb({ sites: [{ id: SITE, voice_text: null, voice_edited_at: null }] });

    await saveVoiceText({ siteId: SITE, text: "Short sentences. No hype." });

    expect(db.tables.sites?.[0]?.voice_text).toBe("Short sentences. No hype.");
    expect(db.tables.sites?.[0]?.voice_edited_at).not.toBeNull();
  });

  it("seeds nothing when the pass read no voice at all", async () => {
    db = fakeProfileDb({
      site_profiles: [profileRow({ voice: null })],
      sites: [{ id: SITE, voice_text: null, voice_edited_at: null }],
    });

    expect(await adoptVoiceText({ siteId: SITE, domain: DOMAIN })).toBe(false);
    expect(db.tables.sites?.[0]?.voice_text).toBeNull();
  });
});
