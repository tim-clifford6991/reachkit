// Issue 2378 condition 1: `RULE_BRIEF` is total over `HardRule`, so a copy of it missing one rule's line fails `tsc`.
import { RULE_BRIEF, type BriefLineInputs } from "@/lib/generate/rules/brief-lines";
import type { HardRule } from "@/lib/generate/rules/types";

const { cites_market: dropped, ...rest } = RULE_BRIEF;
// @ts-expect-error `cites_market` has no line, and a `Record` over `HardRule` asks one of every rule.
export const missingOne: Readonly<Record<HardRule, (a: BriefLineInputs) => string | readonly string[] | null>> = rest;
export const kept = dropped;
