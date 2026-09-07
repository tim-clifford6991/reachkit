// tests/publish/destinations/wordpress/stamp-place.test.ts — issue #160,
// REQ-079 criterion 6: the deleted-account mail names a place only where
// the site took the term, and still carries every count where it did not.
//
// The port has been unanswered since #52 wrote it, and the failure it is
// held open against is a specific one: a departing customer told to look in
// a list, following the link, and finding nothing there. So the rows here
// are mostly about what is *not* a place —
//
//  · `null` on the column is "nobody asked", not "yes";
//  · `false` is "this site would not take the term";
//  · a destination with no credential left has no address to give;
//
// — and each of them must still leave the outcome's own count in the mail.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { seal } from "@/lib/publish/destinations/config";
import {
  installStampCapability,
  stampPlace,
} from "@/lib/publish/destinations/wordpress/stamp-place";
import {
  leftInWordPress,
  setStampCapability,
} from "@/lib/account/lifecycle/left-in-wordpress";
import { WORDPRESS } from "@/lib/config/constants";

const CREDENTIAL = {
  baseUrl: "https://blog.example.com",
  username: "reachkit-bot",
  applicationPassword: "abcd EFGH ijkl",
};

function seedDestination(over: Row = {}): void {
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "wordpress",
      config: seal(CREDENTIAL),
      health: "ok",
      health_reason: null,
      health_changed_at: "2026-09-01T00:00:00.000Z",
      broken_mail_sent_at: null,
      last_checked_at: "2026-09-06T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      deleted_at: null,
      publish_capable: true,
      stamp_capable: true,
      ...over,
    },
  ]);
}

beforeEach(() => {
  db.reset();
  setStampCapability(null);
});

describe("the place, read from the stored fact and the destination's own credential", () => {
  it("a site the probe found will carry the term has a place — its own address and the stamp slug", async () => {
    seedDestination();
    expect(await stampPlace("dest-1")).toEqual({
      siteBaseUrl: CREDENTIAL.baseUrl,
      stampSlug: WORDPRESS.stampSlug,
    });
  });

  it("the base URL comes from the sealed credential and is not stored a second time", async () => {
    seedDestination();
    const place = await stampPlace("dest-1");
    // The row this module read carries no address at all: `store.ts`'s
    // select list does not name `config`, and nothing else on the row is
    // the site's URL.
    expect(Object.keys(db.rows("destinations")[0] as Row)).not.toContain("base_url");
    expect(place?.siteBaseUrl).toBe(CREDENTIAL.baseUrl);
  });

  it("it renders no sentence and builds no URL text — two values, and the mail does the rest", async () => {
    seedDestination();
    const place = await stampPlace("dest-1");
    expect(Object.keys(place ?? {}).sort()).toEqual(["siteBaseUrl", "stampSlug"]);
  });
});

describe("**`true` is a place and nothing else is**", () => {
  it.each([
    ["a site that would not take the term", { stamp_capable: false }],
    ["a destination no probe has reached", { stamp_capable: null }],
    ["a destination whose credential is gone", { config: null }],
  ] as const)("%s has none", async (_name, over) => {
    seedDestination(over as Row);
    expect(await stampPlace("dest-1")).toBeNull();
  });

  it("a destination that is not there at all has none", async () => {
    expect(await stampPlace("dest-missing")).toBeNull();
  });
});

describe("REQ-079 c6 — the counts stand whether or not there is a place", () => {
  const outcomes = [
    { destination: "wordpress", outcome: "returned_to_draft" as const },
    { destination: "wordpress", outcome: "returned_to_draft" as const },
    { destination: "wordpress", outcome: "already_gone" as const },
  ];

  it("with the port wired and the site stamped, the sentence carries its count and its place", async () => {
    seedDestination();
    installStampCapability();
    const map = await leftInWordPress({ outcomes, destinationId: "dest-1" });
    expect(map.returned_to_draft).toEqual({
      count: 2,
      place: { siteBaseUrl: CREDENTIAL.baseUrl, stampSlug: WORDPRESS.stampSlug },
    });
  });

  it("with the site unstamped, the same sentence still carries its count and names no place", async () => {
    seedDestination({ stamp_capable: false });
    installStampCapability();
    const map = await leftInWordPress({ outcomes, destinationId: "dest-1" });
    expect(map.returned_to_draft).toEqual({ count: 2, place: null });
  });

  it("`already_gone` names no place even at a stamped site — there is nothing there to find", async () => {
    seedDestination();
    installStampCapability();
    const map = await leftInWordPress({ outcomes, destinationId: "dest-1" });
    expect(map.already_gone).toEqual({ count: 1, place: null });
  });
});
