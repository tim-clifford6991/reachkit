// §9.4 tool classes: D = data call (cheap, wide), L = LLM call (expensive, narrow).
export type ToolClass = "D" | "L";

export interface ToolDefinition<Args = unknown, Result = unknown> {
  name: string;          // find_competitors | get_reviews | ... (the 10 names in §9.4)
  klass: ToolClass;
  run(args: Args, ctx: ToolContext): Promise<Result>;
}

export interface ToolContext { scanId: string | null; mode: "ios" | "android" | "web"; budget: ScanBudget; }

export class BudgetExceededError extends Error {}

// §9.5: every loop runs under a budget; 30-60 tool-call ceiling, per-scan cents cap (§13).
export class ScanBudget {
  private toolCalls = 0; private cents = 0;
  constructor(private readonly limits: { maxToolCalls: number; budgetCents: number }) {}
  charge(use: { toolCalls: number; cents: number }) {
    if (this.toolCalls + use.toolCalls > this.limits.maxToolCalls)
      throw new BudgetExceededError(`tool-call cap ${this.limits.maxToolCalls} exceeded`);
    if (this.cents + use.cents > this.limits.budgetCents)
      throw new BudgetExceededError(`budget ${this.limits.budgetCents} cents exceeded`);
    this.toolCalls += use.toolCalls; this.cents += use.cents;
  }
  get spentCents() { return this.cents; }
  get callsMade() { return this.toolCalls; }
}

// Registry skeleton — the 10 tool names declared; bodies land in Phase 1b / Cycle 2-3.
export const TOOL_NAMES = [
  "find_competitors","get_reviews","get_listing","search_keywords","search_web",
  "find_communities","find_creators","check_link","track_rank","verify_action",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export const registry = new Map<ToolName, ToolDefinition>();
