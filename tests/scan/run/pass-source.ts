// The pass's source as one text: the tier table first, then run.ts and its stage files.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SCAN = path.resolve(import.meta.dirname, "../../../src/lib/scan");
const STAGES = path.join(SCAN, "pass");

export const PASS_SOURCE = [
  path.join(STAGES, "tier.ts"),
  path.join(SCAN, "run.ts"),
  ...readdirSync(STAGES).filter((f) => f !== "tier.ts").sort().map((f) => path.join(STAGES, f)),
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
