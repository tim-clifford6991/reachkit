import { expect, test } from "vitest";
import { countMentions } from "./competitor-mentions";

test("counts case-insensitive mentions across community docs", () => {
  const docs = [
    [{ title: "Best Opal alternatives?" }, { title: "Forest vs OPAL" }],
    [{ title: "unrelated thread" }],
  ];
  expect(countMentions("Opal", docs)).toBe(2);
  expect(countMentions("Forest", docs)).toBe(1);
  expect(countMentions("Nudgi", docs)).toBe(0);
});

test("matches title or body, handles strings + empties", () => {
  const docs = [
    [{ title: "thread", body: "have you tried Habitica?" }],
    ["plain Habitica mention"],
  ];
  expect(countMentions("Habitica", docs)).toBe(2);
  expect(countMentions("", docs)).toBe(0);
  expect(countMentions("Habitica", [])).toBe(0);
});
