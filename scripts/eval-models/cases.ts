// The one case loader every driver reads through. The repository is public and the cases are production rows, so a
// file is refused whole, before any field is used, unless it is private, intact, of the owner's own site, and holds no
// account key, address or secret. A refusal names the rule and the file, never the value it found.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

/** reachkit.app, the owner's own site: the only site an evaluation case may hold. */
export const SITE_ID = "0bbcc532-e420-447c-9e81-f05ccbda27ff";

const FORBIDDEN_KEY = /(^|_)(user_id|e?mail|email|token|token_hash|password|secret|api_?key|service_role|stripe|customer_id)($|_)/i;
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const SECRET = /sk-ant-|sk_live_|rk_live_|whsec_|(^|[^A-Za-z0-9])re_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

export class CaseRefused extends Error {
  constructor(file: string, rule: string) {
    super(`case file refused, nothing read from it: ${file}: ${rule}`);
    this.name = "CaseRefused";
  }
}

/** A row as the export writes it: the case as JSON text, its length in characters and its md5. */
interface Row {
  doc: string;
  len: number;
  md5: string;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, line breaks inside quotes. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

/** The file's rows: a CSV with a `doc,len,md5` header, or JSON holding one such row or a list of them. */
function rowsOf(file: string, text: string): Row[] {
  if (file.endsWith(".csv")) {
    const [header, ...body] = csvRows(text);
    const at = (name: string) => header?.indexOf(name) ?? -1;
    if (at("doc") < 0 || at("len") < 0 || at("md5") < 0) throw new CaseRefused(file, "not a doc,len,md5 export");
    return body.map((cells) => ({ doc: cells[at("doc")] ?? "", len: Number(cells[at("len")]), md5: cells[at("md5")] ?? "" }));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CaseRefused(file, "not JSON");
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (!list.every((r) => typeof r?.doc === "string" && typeof r?.len === "number" && typeof r?.md5 === "string")) throw new CaseRefused(file, "not a doc,len,md5 row");
  return list as Row[];
}

/** The first rule the document breaks, walking every key and string at any depth; `null` where it breaks none. */
function contentBreak(value: unknown, parentKey = ""): string | null {
  if (typeof value === "string") {
    for (const [address] of value.matchAll(EMAIL)) if (!address.toLowerCase().endsWith("@reachkit.app")) return "an e-mail address outside @reachkit.app";
    return SECRET.test(value) ? "a secret's shape" : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const broke = contentBreak(item, parentKey);
      if (broke !== null) return broke;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) return `a forbidden key (${key})`;
    const isSiteId = key === "site_id" || key === "siteId" || (key === "id" && (parentKey === "site" || parentKey === "sites"));
    if (isSiteId && child !== SITE_ID) return "a site other than reachkit.app";
    const broke = contentBreak(child, key);
    if (broke !== null) return broke;
  }
  return null;
}

/** Every case in one file, parsed, or `CaseRefused` before anything in it is used. */
export function loadCaseFile(file: string, repoRoot: string): unknown[] {
  const real = realpathSync(file);
  const rel = path.relative(realpathSync(repoRoot), real);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) throw new CaseRefused(file, "inside the repository");
  if ((statSync(path.dirname(real)).mode & 0o777) !== 0o700) throw new CaseRefused(file, "its folder is not mode 700");
  if ((statSync(real).mode & 0o777) !== 0o600) throw new CaseRefused(file, "it is not mode 600");
  const rows = rowsOf(file, readFileSync(real, "utf8"));
  for (const row of rows) {
    // Postgres counts `length(doc)` in characters and hashes the UTF-8 bytes.
    if ([...row.doc].length !== row.len || createHash("md5").update(row.doc, "utf8").digest("hex") !== row.md5) throw new CaseRefused(file, "len or md5 does not match its doc");
  }
  const docs = rows.map((row) => {
    try {
      return JSON.parse(row.doc) as unknown;
    } catch {
      throw new CaseRefused(file, "a doc that is not JSON");
    }
  });
  for (const doc of docs) {
    const broke = contentBreak(doc);
    if (broke !== null) throw new CaseRefused(file, broke);
  }
  return docs;
}
