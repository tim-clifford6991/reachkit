import { expect, test } from "vitest";
import { ageYearsFromCdx } from "./domain-age";

test("ageYearsFromCdx computes years from earliest snapshot timestamp", () => {
  const rows = [["timestamp"], ["20190101000000"]]; // rows[0] is the CDX header
  expect(ageYearsFromCdx(rows, new Date("2026-01-01"))).toBe(7);
});
test("ageYearsFromCdx returns null when no snapshots", () => {
  expect(ageYearsFromCdx([["timestamp"]], new Date("2026-01-01"))).toBeNull();
});
