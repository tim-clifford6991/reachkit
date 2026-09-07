// BUILD §2.5 — the generated-text brand's one public entry.
// src/lib/presentation/generated/index.ts — BP-020, WO-279 (supersedes WO-043)
//
// The module's public entry point. Re-exports exactly the symbols BP-020
// `## Public interface` names for this file plan — nothing else.
export {
  type GeneratedText,
  type GeneratedColumn,
  type PageIdentity,
  fromStored,
  renderGenerated,
  generatedLabel,
} from "./text.ts";
export { renderQuestion } from "./question.ts";
