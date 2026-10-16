// tests/scan/free/blocked/recorded.ts — the vendors' real answers for
// `../blocked-site-market.test.ts` (SPEC §2, issue 1387). Not a suite.
//
// Each `<domain>.json` here holds what DataForSEO Labs and the model answered
// when the free pass was run once on that site with its home page blocked:
// the site's ranked searches, the keyword suggestions for the seeds the pass
// chose, and the two model calls (the profile and the phrasing). A Labs
// answer is kept as the vendor's own envelope, cut to the fields the product
// reads. The twelve Google reads are not recorded; the suite doubles them.
//
// # Recording
//
//   RK_RECORD=1 RK_ENV_FILE=/root/projects/reachkitv3/.env.local \
//     RK_SPEND_LOG=/root/ops/reachkit/spend.jsonl \
//     npx vitest run --project node tests/scan/free/blocked-site-market.test.ts
//
// It buys only what a file does not hold yet, through `curl`, with the keys
// read from the env file and never put into the product's own bindings. A
// run without `RK_RECORD` reaches no vendor: a request no file holds fails
// the test.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appendSpend } from "../../../../scripts/spend-log.mjs";

export const RECORDING = process.env.RK_RECORD === "1";

interface VendorEntry {
  key: string;
  response: unknown;
}
interface ModelEntry {
  key: string;
  response: { content: unknown; usage: { input_tokens: number; output_tokens: number } };
}
export interface Recording {
  domain: string;
  recordedOn: string;
  vendor: VendorEntry[];
  model: ModelEntry[];
}

const fileOf = (domain: string): string => path.join(__dirname, `${domain}.json`);

export function loadRecording(domain: string): Recording {
  const file = fileOf(domain);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Recording;
  return { domain, recordedOn: new Date().toISOString().slice(0, 10), vendor: [], model: [] };
}

function save(recording: Recording): void {
  writeFileSync(fileOf(recording.domain), `${JSON.stringify(recording, null, 1)}\n`);
}

/** A Labs request as one line: the endpoint and what was asked of it. */
export function vendorKey(url: string, task: Record<string, unknown>): string {
  const asked = [task.target ?? task.keyword, task.limit, task.location_name ?? task.location_code, task.language_name ?? task.language_code];
  // The whole task decides the answer (a suggestions read carries its
  // volume window); the readable part is for whoever opens the file.
  const whole = createHash("sha256").update(JSON.stringify(task)).digest("hex").slice(0, 8);
  return `${new URL(url).pathname} ${asked.map((part) => String(part ?? "")).join("|")} #${whole}`;
}

export function modelKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const pick = (from: unknown, keys: readonly string[]): Json =>
  isObject(from) ? Object.fromEntries(keys.filter((key) => from[key] !== undefined).map((key) => [key, from[key]])) : {};

/** One Labs item, cut to what `src/lib/vendors/dataforseo/labs.ts` reads. */
function cutItem(item: unknown): unknown {
  if (!isObject(item)) return item;
  const keyword = (from: unknown): Json => ({
    ...pick(from, ["keyword"]),
    ...(isObject(from) && isObject(from.keyword_info) ? { keyword_info: pick(from.keyword_info, ["search_volume"]) } : {}),
    ...(isObject(from) && isObject(from.keyword_properties) ? { keyword_properties: pick(from.keyword_properties, ["keyword_difficulty"]) } : {}),
  });
  if (isObject(item.keyword_data)) {
    const element = isObject(item.ranked_serp_element) ? item.ranked_serp_element : {};
    return {
      keyword_data: keyword(item.keyword_data),
      ranked_serp_element: { serp_item: pick(element.serp_item, ["type", "rank_group", "rank_absolute", "url", "title", "description", "etv"]) },
    };
  }
  return keyword(item);
}

function cutEnvelope(body: unknown): unknown {
  if (!isObject(body) || !Array.isArray(body.tasks)) return body;
  return {
    ...pick(body, ["status_code", "status_message", "cost"]),
    tasks: body.tasks.map((task: unknown) => ({
      ...pick(task, ["id", "status_code", "status_message", "cost"]),
      result: !isObject(task) || !Array.isArray(task.result)
        ? null
        : task.result.map((result: unknown) => ({
            ...pick(result, ["target", "seed_keyword", "location_code", "language_code", "total_count", "items_count"]),
            items: isObject(result) && Array.isArray(result.items) ? result.items.map(cutItem) : null,
          })),
    })),
  };
}

function keysOf(): { login: string; password: string; anthropic: string } {
  const file = process.env.RK_ENV_FILE ?? "";
  if (!existsSync(file)) throw new Error("recorded.ts: RK_RECORD needs RK_ENV_FILE, the env file holding the two vendors' keys.");
  const read = (name: string): string => {
    const value = new RegExp(`^${name}=(.*)$`, "m").exec(readFileSync(file, "utf8"))?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (value === "" || value.startsWith("PENDING")) throw new Error(`recorded.ts: ${name} is not a real key in ${file}.`);
    return value;
  };
  return { login: read("DATAFORSEO_LOGIN"), password: read("DATAFORSEO_PASSWORD"), anthropic: read("ANTHROPIC_API_KEY") };
}

function post(url: string, headers: readonly string[], body: unknown): unknown {
  const out = execFileSync(
    "curl",
    ["-sS", "--fail-with-body", "-m", "60", "-X", "POST", url, ...headers.flatMap((header) => ["-H", header]), "-H", "content-type: application/json", "--data-binary", "@-"],
    { input: JSON.stringify(body), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(out) as unknown;
}

/** A Labs answer: the file's, or bought once while recording. */
export function labsAnswer(recording: Recording, url: string, task: Record<string, unknown>): unknown {
  const key = vendorKey(url, task);
  const held = recording.vendor.find((entry) => entry.key === key);
  if (held !== undefined) return held.response;
  if (!RECORDING) throw new Error(`recorded.ts: ${recording.domain}.json holds no answer for "${key}".`);
  const keys = keysOf();
  const basic = Buffer.from(`${keys.login}:${keys.password}`).toString("base64");
  const body = post(url, [`Authorization: Basic ${basic}`], [task]);
  const response = cutEnvelope(body);
  recording.vendor.push({ key, response });
  save(recording);
  const dollars = isObject(body) && typeof body.cost === "number" ? body.cost : 0;
  appendSpend({ script: "record-blocked-site", source: new URL(url).pathname, cents: dollars * 100 });
  return response;
}

/** $ per million tokens of the nano tier's model, for the spend log only. */
const NANO_USD_PER_MTOK = { in: 1, out: 5 };

/** A model answer: the file's, or asked once while recording. */
/** A recording made before issue 1454 asked the profile call without its
 *  offerings, kind and reach. Its answer is read under the input it was
 *  recorded for, and the profile reads the three as none, so the recorded
 *  scans replay at 0¢. */
function beforeIssue1454(input: string): string {
  try {
    const parsed = JSON.parse(input) as { fields?: Record<string, unknown> };
    if (parsed.fields === undefined || !("offerings" in parsed.fields)) return input;
    const fields = Object.fromEntries(Object.entries(parsed.fields).filter(([field]) => !["offerings", "kind", "reach"].includes(field)));
    return JSON.stringify({ ...parsed, fields });
  } catch {
    return input;
  }
}

export function modelAnswer(recording: Recording, request: { messages: { content: string }[] }): ModelEntry["response"] {
  const key = modelKey(request.messages[0]?.content ?? "");
  const held =
    recording.model.find((entry) => entry.key === key) ??
    recording.model.find((entry) => entry.key === modelKey(beforeIssue1454(request.messages[0]?.content ?? "")));
  if (held !== undefined) return held.response;
  if (!RECORDING) throw new Error(`recorded.ts: ${recording.domain}.json holds no model answer for input ${key}.`);
  const message = post("https://api.anthropic.com/v1/messages", [`x-api-key: ${keysOf().anthropic}`, "anthropic-version: 2023-06-01"], request) as ModelEntry["response"];
  const response = { content: message.content, usage: pick(message.usage, ["input_tokens", "output_tokens"]) as ModelEntry["response"]["usage"] };
  recording.model.push({ key, response });
  save(recording);
  appendSpend({
    script: "record-blocked-site",
    source: "llm",
    cents: (response.usage.input_tokens * NANO_USD_PER_MTOK.in + response.usage.output_tokens * NANO_USD_PER_MTOK.out) / 10_000,
  });
  return response;
}
