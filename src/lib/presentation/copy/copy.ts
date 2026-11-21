// BUILD §2.5 — one sentence, resolved from its key.
//
// One property read plus named-slot substitution, no interpolation engine:
// a slot is the literal text `{name}` inside the sentence. A slot the caller
// does not supply throws naming it, so a half-substituted sentence never
// reaches a screen. No network, no clock, no reader parameter.
import { COPY, slotsOf, type CopyKey } from "./registry.ts";

export function copy(key: CopyKey, vars?: Record<string, string | number>): string {
  if (COPY[key] === "") {
    throw new Error(`copy(): "${key}" is owner-owed — no sentence has been written for it yet.`);
  }

  let text: string = COPY[key];
  for (const slotName of slotsOf(text)) {
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, slotName)) {
      throw new Error(`copy(): "${key}" requires slot "${slotName}", which was not supplied.`);
    }
    text = text.split(`{${slotName}}`).join(String(vars[slotName]));
  }

  return text;
}
