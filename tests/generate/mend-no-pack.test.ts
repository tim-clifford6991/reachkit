// A structure mend is checked against its live version's pack, so a page that went live with none takes the writer's update.
import "./env";
import { expect, it } from "vitest";
import { memoryStore, opportunity } from "./fixtures";

it("a mend of a live page with no stored pack goes to the writer, and one with a pack stays a 0¢ mend", async () => {
  const [{ setGenerateStore }, { refreshedInCode }] = await Promise.all([import("../../src/lib/generate/store"), import("../../src/lib/generate/day-refresh")]);
  const at = async (meta: object) => (setGenerateStore(memoryStore({ liveVersionAt: async () => ({ draft: { meta }, publishedAt: new Date() }) } as never)), refreshedInCode("s", opportunity({ type: "refresh_page", targetRef: "https://example.com/a", evidence: { shortfall: { cause: "structure", defects: ["repeated_links", "h1"] } } } as never), false));
  expect([await at({ intent: "x" }), await at({ pack: {} })]).toEqual([false, true]);
});
