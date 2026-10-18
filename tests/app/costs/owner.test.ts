// tests/app/costs/owner.test.ts — issue 1478: the cost page is the owner's.
// An account signed in at an address `OWNER_EMAILS` names gets it, whatever
// the case it was typed in; any other account, and one that cannot be read,
// does not.
import "../../generate/env";
import { describe, expect, it, vi } from "vitest";

const { emails } = vi.hoisted(() => ({ emails: new Map<string, string>() }));

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          limit: async () => (id === "unreadable" ? { data: null, error: { message: "down" } } : { data: emails.has(id) ? [{ email: emails.get(id) }] : [], error: null }),
        }),
      }),
    }),
  }),
}));

const { env } = await import("@/lib/config/env");
const { isOwner } = await import("@/app/(account)/app/costs/owner");

describe("who opens /app/costs", () => {
  it("an owner's address does, a customer's does not", async () => {
    const owner = env.OWNER_EMAILS[0]!;
    emails.set("owner", owner.toUpperCase());
    emails.set("customer", "founder@bakery-fixture.com");
    expect(await isOwner("owner")).toBe(true);
    expect(await isOwner("customer")).toBe(false);
    expect(await isOwner("unreadable")).toBe(false);
    expect(await isOwner("nobody")).toBe(false);
  });
});
