// The target's two numbers, rendered once: the page screen's headline tiles
// (`TargetNumbers`) state its demand and difficulty, dash and written line
// included, through `renderMeasured` (REQ-004), never a `0`.
import { renderMeasured } from "@/lib/presentation/measured";
import { formatCount } from "../_shell/page-target-words";
import type { TargetFacts } from "./target";

export function targetReadings(facts: Pick<TargetFacts, "volume" | "difficulty" | "search">) {
  return {
    volume: renderMeasured(facts.volume, {
      format: formatCount,
      unmeasuredLine: "unmeasured.undeterminable",
      what: facts.search,
    }),
    difficulty: renderMeasured(facts.difficulty, {
      format: (v) => String(v),
      unmeasuredLine: "unmeasured.undeterminable",
      what: facts.search,
    }),
  };
}
