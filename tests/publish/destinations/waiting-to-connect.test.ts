// SPEC §5 — what a site still has to connect before any page publishes, read once for every screen from stored rows.
import { describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { destinationWaitingToConnect } = await import("@/lib/publish/destinations");

const HOSTED = { kind: "hosted", hostname: "blog.acme.example", health_reason: null };
const WORDPRESS = { kind: "wordpress", hostname: null, hostname_state: null, health: "expired" };

describe("destinationWaitingToConnect", () => {
  it.each<[string, Row | null, "dns" | "wordpress" | null]>([
    ["a hosted address waiting for its record", { ...HOSTED, hostname_state: "pending_dns", health: "expired" }, "dns"],
    ["a hosted address the domain list never answered for", { ...HOSTED, hostname_state: null, health: "expired" }, "dns"],
    ["a hosted address that is live", { ...HOSTED, hostname_state: "live", health: "ok" }, null],
    ["a WordPress never given its login", { ...WORDPRESS, health_reason: "never_connected" }, "wordpress"],
    ["a WordPress that worked and broke", { ...WORDPRESS, health_reason: "credentials_expired" }, null],
    ["no destination at all", null, null],
  ])("%s", async (_, destination, waiting) => {
    db.reset();
    db.seed("destinations", destination === null ? [] : [{ id: "dest-1", site_id: "site-1", deleted_at: null, ...destination }]);
    expect(await destinationWaitingToConnect("site-1")).toBe(waiting);
  });
});
