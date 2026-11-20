// Every answer an evaluated call came back with, read the way it came (the tool's input, or JSON in its text) and kept
// in a private file, so a run is scored from what the model said and can be scored again later without paying again.
import { appendFileSync, chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

export type From = "tool" | "text" | "none";

const parse = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/** The first balanced object or array in the text, outside strings. */
function firstBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\\") i++;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === "{" || ch === "[") depth++;
    else if ((ch === "}" || ch === "]") && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** What the answer said: the tool's input where the model called it; else the JSON in its text, whole, inside a fence,
 *  or the first balanced value, as the product's own text reader tries them; else nothing. */
export function answerOf(message: Anthropic.Message): { from: From; value: unknown } {
  const tool = message.content.find((block) => block.type === "tool_use");
  if (tool !== undefined) return { from: "tool", value: tool.input };
  const text = message.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text.trim() ?? "";
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  for (const candidate of [text, fence, firstBalanced(text)]) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const read = parse(candidate);
    if (read.ok) return { from: "text", value: read.value };
  }
  return { from: "none", value: null };
}

/** One line appended to a file only its owner can read, in a folder only its owner can open. */
export function keepAnswer(file: string, line: object): void {
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    chmodSync(path.dirname(file), 0o700);
    closeSync(openSync(file, "a", 0o600));
  }
  chmodSync(file, 0o600);
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

/** The kept lines of a file, each one answer. */
export function keptAnswers(file: string): Record<string, unknown>[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
