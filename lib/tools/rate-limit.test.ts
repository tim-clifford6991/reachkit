import { beforeEach, expect, test } from "vitest";
import {
  TOOL_RATE_LIMIT,
  checkToolRateLimit,
  ipFromHeaderStore,
  resetToolRateLimit,
} from "./rate-limit";

beforeEach(() => resetToolRateLimit());

test("allows up to the limit then blocks", () => {
  const now = 1_000_000;
  for (let i = 0; i < TOOL_RATE_LIMIT; i++) {
    expect(checkToolRateLimit("1.2.3.4", now + i)).toBe(true);
  }
  expect(checkToolRateLimit("1.2.3.4", now + TOOL_RATE_LIMIT)).toBe(false);
});

test("window slides — old hits expire after an hour", () => {
  const now = 1_000_000;
  for (let i = 0; i < TOOL_RATE_LIMIT; i++) checkToolRateLimit("1.2.3.4", now);
  expect(checkToolRateLimit("1.2.3.4", now + 1)).toBe(false);
  expect(checkToolRateLimit("1.2.3.4", now + 60 * 60 * 1000 + 1)).toBe(true);
});

test("ips are independent and unknown is never limited", () => {
  const now = 1_000_000;
  for (let i = 0; i < TOOL_RATE_LIMIT; i++) checkToolRateLimit("1.2.3.4", now);
  expect(checkToolRateLimit("5.6.7.8", now)).toBe(true);
  for (let i = 0; i < TOOL_RATE_LIMIT * 2; i++) {
    expect(checkToolRateLimit("unknown", now)).toBe(true);
  }
});

test("ipFromHeaderStore prefers first x-forwarded-for hop", () => {
  const h = (entries: Record<string, string>) => ({
    get: (k: string) => entries[k] ?? null,
  });
  expect(ipFromHeaderStore(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  expect(ipFromHeaderStore(h({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  expect(ipFromHeaderStore(h({}))).toBe("unknown");
});
