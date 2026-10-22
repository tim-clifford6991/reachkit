import { it } from "vitest";

it("a hang goes red at the 20 s timeout", async () => {
  await new Promise(() => {});
});
