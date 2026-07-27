/**
 * Guard for the draft-action-persist capability (owner 2026-07-27: a generated
 * draft must ALWAYS be retained). Proves the find-or-create-and-store contract
 * both draft routes rely on:
 *   - a stored draft is REUSED for free (no LLM call) unless regenerate,
 *   - a regenerate OVERWRITES the stored draft (a redraft must persist),
 *   - a brand-new topic INSERTS a review-required action carrying its draft,
 *   - only OPEN actions match; a done one doesn't block a fresh draft,
 *   - a lookup failure throws (route → 500) rather than silently dropping work.
 * Mutation-proof: break the reuse guard and (2) fails; break the overwrite and (3).
 */

import { describe, it, expect, vi } from "vitest";
import { upsertDraftAction } from "./draft-action-store";
import type { ServerDb } from "@/lib/db/client";

interface Row {
  id: string;
  status: string;
  draft: string | null;
}

function makeDb(opts: {
  existing?: Row[];
  insertId?: string;
  findError?: string;
}) {
  const calls: { updatedId?: string; updatePatch?: Record<string, unknown>; insertRow?: Record<string, unknown> } = {};

  // `.select(...).eq(...).eq(...)` resolves to the find result; the chain is thenable.
  const selectChain = {
    eq() {
      return selectChain;
    },
    then(onF: (v: { data: Row[] | null; error: { message: string } | null }) => unknown) {
      const v = opts.findError
        ? { data: null, error: { message: opts.findError } }
        : { data: opts.existing ?? [], error: null };
      return Promise.resolve(v).then(onF);
    },
  };

  const db = {
    from() {
      return {
        select: () => selectChain,
        update(patch: Record<string, unknown>) {
          calls.updatePatch = patch;
          return {
            eq: (_col: string, id: string) => {
              calls.updatedId = id;
              return Promise.resolve({ error: null });
            },
          };
        },
        insert(row: Record<string, unknown>) {
          calls.insertRow = row;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: opts.insertId ?? "new-id" }, error: null }),
            }),
          };
        },
      };
    },
  };

  return { db: db as unknown as ServerDb, calls };
}

const INPUT = { title: "Post an SEO audit template", category: "outreach" as const };

describe("upsertDraftAction — a generated draft is always persisted", () => {
  it("inserts a new review-required action carrying the draft when none exists", async () => {
    const { db, calls } = makeDb({ existing: [], insertId: "a1" });
    const generate = vi.fn(async () => "FRESH DRAFT");

    const res = await upsertDraftAction(db, "app1", INPUT, generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(res).toEqual({ actionId: "a1", draft: "FRESH DRAFT", reused: false });
    expect(calls.insertRow).toMatchObject({
      app_id: "app1",
      category: "outreach",
      title: INPUT.title,
      status: "pending",
      draft: "FRESH DRAFT",
      draft_requires_edit: true,
    });
  });

  it("REUSES a stored draft for free (no LLM call) when not regenerating", async () => {
    const { db } = makeDb({ existing: [{ id: "a2", status: "pending", draft: "STORED" }] });
    const generate = vi.fn(async () => "SHOULD NOT RUN");

    const res = await upsertDraftAction(db, "app1", INPUT, generate);

    expect(generate).not.toHaveBeenCalled();
    expect(res).toEqual({ actionId: "a2", draft: "STORED", reused: true });
  });

  it("OVERWRITES the stored draft on regenerate (a redraft must persist)", async () => {
    const { db, calls } = makeDb({ existing: [{ id: "a3", status: "pending", draft: "OLD" }] });
    const generate = vi.fn(async () => "NEW DRAFT");

    const res = await upsertDraftAction(db, "app1", { ...INPUT, regenerate: true }, generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(calls.updatedId).toBe("a3");
    expect(calls.updatePatch).toMatchObject({ draft: "NEW DRAFT", draft_requires_edit: true });
    expect(res).toEqual({ actionId: "a3", draft: "NEW DRAFT", reused: false });
  });

  it("generates + stores when the open action exists but has no draft yet", async () => {
    const { db, calls } = makeDb({ existing: [{ id: "a4", status: "pending", draft: null }] });
    const generate = vi.fn(async () => "FILLED");

    const res = await upsertDraftAction(db, "app1", INPUT, generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(calls.updatedId).toBe("a4");
    expect(res.draft).toBe("FILLED");
  });

  it("ignores a DONE action and inserts a fresh one", async () => {
    const { db, calls } = makeDb({ existing: [{ id: "done1", status: "done", draft: "SHIPPED" }], insertId: "a5" });
    const generate = vi.fn(async () => "FRESH");

    const res = await upsertDraftAction(db, "app1", INPUT, generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(calls.insertRow).toBeDefined();
    expect(res.actionId).toBe("a5");
  });

  it("throws on a lookup error (route returns 500 — never silently drops work)", async () => {
    const { db } = makeDb({ findError: "db down" });
    await expect(upsertDraftAction(db, "app1", INPUT, vi.fn())).rejects.toThrow(/lookup failed/);
  });

  it("persists outreach routing (target/verifyUrl) onto the inserted action", async () => {
    const { db, calls } = makeDb({ existing: [], insertId: "a6" });
    await upsertDraftAction(
      db,
      "app1",
      { ...INPUT, target: { channel: "community", label: "r/SEO" }, verifyUrl: "https://reddit.com/r/SEO", effortMin: 20 },
      vi.fn(async () => "D"),
    );
    expect(calls.insertRow).toMatchObject({
      verify_url: "https://reddit.com/r/SEO",
      effort_min: 20,
      target: { channel: "community", label: "r/SEO" },
    });
  });
});
