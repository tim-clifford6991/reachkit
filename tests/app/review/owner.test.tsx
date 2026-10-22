// /app/review is the owner's, by the gate /app/costs uses: an owner's
// account gets the screen, a customer's and a signed-out visitor get its
// 404.
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { emails } = vi.hoisted(() => ({ emails: new Map<string, string>() }));

/** Users answer by id; every other table holds no rows. */
vi.mock("@/lib/db", () => {
  const query = (table: string) => {
    let id = "";
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "is", "not", "in", "order", "limit"]) {
      builder[method] = (column: string, value: unknown) => {
        if (method === "eq" && column === "id") id = String(value);
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve(table === "users" ? { data: emails.has(id) ? [{ email: emails.get(id) }] : [], error: null } : { data: [], error: null });
    return builder;
  };
  return { dbAdmin: () => ({ from: query }) };
});

const { env } = await import("@/lib/config/env");
const { copy } = await import("@/lib/presentation/copy");
const { default: ReviewPage } = await import("@/app/(account)/app/review/page");
const { LIVE_ACCOUNT, resetAccount, signedInAs, signedOut } = await import("../account-door");

afterEach(resetAccount);

async function digestOf(): Promise<string | undefined> {
  try {
    await ReviewPage();
    return undefined;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
}

describe("who opens /app/review", () => {
  it("an owner gets the screen", async () => {
    emails.set(LIVE_ACCOUNT.userId, env.OWNER_EMAILS[0]!.toUpperCase());
    signedInAs(LIVE_ACCOUNT);
    const html = renderToStaticMarkup(await ReviewPage());
    expect(html).toContain(copy("review.title"));
    expect(html).toContain(copy("review.no-sites"));
    emails.clear();
  });

  it("a customer gets the 404", async () => {
    emails.set(LIVE_ACCOUNT.userId, "founder@bakery-fixture.com");
    signedInAs(LIVE_ACCOUNT);
    expect(await digestOf()).toMatch(/404/);
    emails.clear();
  });

  it("a signed-out visitor gets the 404", async () => {
    signedOut();
    expect(await digestOf()).toMatch(/404/);
  });
});
