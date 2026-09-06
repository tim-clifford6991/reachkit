// tests/account/lifecycle/purge.test.ts — REQ-079 c7
//
// "when 30 days have passed, then the account and the sign-in address it was
// reached at, the site, its pages, drafts, measurements, destination
// credentials and every copy ReachKit holds of the customer's own page
// content — including the passages copied from their live pages and kept as
// a draft's grounding evidence … whose retention ends here — are no longer
// present in ReachKit's stored data at all."
//
// One case per class the criterion names, plus the two properties that make
// the purge safe to run on a schedule: it is idempotent, and a row it cannot
// remove raises rather than reporting success.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { accountsDueForPurge, purgeAccount, PurgeIncomplete, PURGE_ORDER, setLifecycleStore } =
  await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle, account } = await import("./memory-store");

const NOW = new Date("2026-10-06T12:00:00.000Z");
let state = newMemoryLifecycle();

beforeEach(() => {
  state = newMemoryLifecycle();
  state.sites.push({ id: "site-1", user_id: "u-1" });
  state.accounts.push(
    account({
      id: "u-1",
      deleted_at: "2026-09-06T12:00:00.000Z",
      purge_due_at: "2026-10-06T12:00:00.000Z",
    })
  );
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

function tables(): string[] {
  return state.deleted.map((step) => step.table);
}

describe("REQ-079 c7 — the enumerated sweep, one case per named class", () => {
  it("the account and the sign-in address it was reached at are gone", async () => {
    await purgeAccount("u-1");
    expect(tables()).toContain("auth_links");
    expect(tables()).toContain("users");
    expect(state.accounts).toEqual([]);
  });

  it("the site, its pages, drafts and measurements are gone", async () => {
    await purgeAccount("u-1");
    for (const table of ["sites", "publications", "drafts", "scans", "opportunities"]) {
      expect(tables(), `${table} was not purged`).toContain(table);
    }
    expect(state.sites).toEqual([]);
  });

  it("destination credentials are gone", async () => {
    await purgeAccount("u-1");
    expect(tables()).toContain("destinations");
  });

  it("drafts.grounded_fact is gone — with the row, not by blanking a column", async () => {
    await purgeAccount("u-1");
    const drafts = state.deleted.find((step) => step.table === "drafts");
    expect(drafts).toEqual({ table: "drafts", column: "site_id", values: ["site-1"] });
  });

  it("every fetched byte kept against one of the site's own scans is gone", async () => {
    await purgeAccount("u-1");
    expect(state.deleted.find((step) => step.table === "fetches")).toEqual({
      table: "fetches",
      column: "scan_id",
      values: ["scan-1"],
    });
  });

  it("the danger-zone ticket goes with the account", async () => {
    await purgeAccount("u-1");
    expect(tables()).toContain("danger_tickets");
  });

  it("children go before their parents, so no delete is refused by a foreign key", async () => {
    await purgeAccount("u-1");
    const order = tables();
    const before = (child: string, parent: string): void => {
      expect(order.indexOf(child), `${child} must go before ${parent}`).toBeLessThan(
        order.indexOf(parent)
      );
    };
    before("page_verdicts", "publications");
    before("publications", "drafts");
    before("drafts", "opportunities");
    before("opportunities", "scans");
    before("fetches", "scans");
    before("leads", "scans");
    before("scans", "sites");
    before("destinations", "sites");
    before("danger_tickets", "sites");
    before("sites", "users");
    before("auth_links", "users");
  });

  it("an address-wide suppression is not purged — it is a person's opt-out, not an account's row", () => {
    expect(PURGE_ORDER.map((step) => step.table)).not.toContain("email_suppressions");
  });
});

describe("REQ-079 c7 — idempotent, resumable, and loud when it cannot finish", () => {
  it("running twice purges once and the second run is a no-op", async () => {
    expect(await purgeAccount("u-1")).toEqual({ purged: true });
    const first = tables();
    state.deleted.length = 0;

    expect(await purgeAccount("u-1")).toEqual({ purged: true });
    // The second run finds no site behind the account, so every site-,
    // scan-, draft- and publication-scoped step has an empty id list and
    // issues no delete at all. What is left is the three steps keyed on the
    // user id, each of which matches nothing and removes nothing.
    expect(first).toContain("drafts");
    expect(tables()).toEqual(["sites", "auth_links", "users"]);
    expect(state.accounts).toEqual([]);
    expect(state.sites).toEqual([]);
  });

  it("an interrupted purge resumes and completes on the next run", async () => {
    state.refuseDelete = "scans";
    await expect(purgeAccount("u-1")).rejects.toBeInstanceOf(PurgeIncomplete);
    expect(tables()).not.toContain("users");
    state.refuseDelete = null;
    expect(await purgeAccount("u-1")).toEqual({ purged: true });
    expect(state.accounts).toEqual([]);
  });

  it("a purge that cannot delete a row raises rather than reporting success", async () => {
    state.refuseDelete = "users";
    await expect(purgeAccount("u-1")).rejects.toThrow(/could not clear users/);
  });

  it("a store that cannot be read is a fault, never an empty purge reported as done", async () => {
    state.unreadable = true;
    await expect(purgeAccount("u-1")).rejects.toBeInstanceOf(PurgeIncomplete);
    await expect(accountsDueForPurge(NOW)).rejects.toBeInstanceOf(PurgeIncomplete);
  });
});
