// BUILD §8 · §14 — no sentence addressed to a machine reader.
//
// A pinned, deterministic pattern battery over the words the published page
// shows. No model judges this: a hard rule decided by a model is a rule
// that sometimes does not hold, and §8's rules are "enforced in code, not
// prompts". No `llm()` import appears in this file, and that absence is the
// enforcement.
//
// The battery decides the forms `MACHINE_ADDRESS_PATTERNS` lists and no
// others — a limit no pass over the corpus can close, since no pattern list
// over natural language can be proved complete. A form found later is added
// in `constants.ts`, in one place.
import { MACHINE_ADDRESS_PATTERNS } from "@/lib/config/constants";
import type { RuleFailure } from "./types";

export function checkMachineAddress(a: { rendered: string }): RuleFailure | null {
  for (const pattern of MACHINE_ADDRESS_PATTERNS) {
    if (pattern.test(a.rendered)) return { rule: "no_machine_address" };
  }
  return null;
}
