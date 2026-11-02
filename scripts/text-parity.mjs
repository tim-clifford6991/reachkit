#!/usr/bin/env node
// scripts/text-parity.mjs — whether the grounding reads the same pages from
// `fetch_text` as from the payloads: for every site and every free-scan
// domain, `readMeasuredText` and `readDomainText` run once without a text
// version and once at this checkout's, and the two `MeasuredText[]` are
// deep-equal (url, text, read time to the millisecond, examples, questions,
// rendered, order). 0¢: no vendor, no model.
//
// Read-only: every write the readers ask for is refused, except the text a
// miss would keep, which is checked to survive a `text`/`jsonb` column
// (JSON, and no NUL Postgres refuses) and then dropped.
//
// # Usage
//
//   node scripts/text-parity.mjs --env-file ../../reachkitv3/.env.local
//
// Prints each mismatch by site or domain and URL, then the counts; exits 1
// on any mismatch. A row a column would refuse is counted, not failed: its
// text is derived again on each read, the same. This box's Node has no type
// stripping, so the repo's own Vite loads the TypeScript.
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { createServer } from "vite";
import { textVersion } from "./derivation.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--env-file");
const PAGE = 1000;

/** Refuses every write but `fetch_text`'s, which it checks and drops. */
function readOnly(admin, tally) {
  const from = admin.from.bind(admin);
  const refuse = (table) => () => {
    throw new Error(`text-parity is read-only: a write to ${table} was asked for.`);
  };
  admin.rpc = refuse("rpc");
  admin.from = (table) => {
    const builder = from(table);
    for (const write of ["insert", "update", "delete"]) builder[write] = refuse(table);
    builder.upsert = table !== "fetch_text" ? refuse(table) : (rows) => {
      for (const row of rows) {
        tally.derived += 1;
        const json = JSON.stringify(row);
        if (json.includes("\\u0000") || !isDeepStrictEqual(JSON.parse(json), row)) tally.unstorable += 1;
      }
      return Promise.resolve({ data: null, error: null });
    };
    return builder;
  };
}

async function all(query) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

function difference(old, now) {
  if (old.length !== now.length) return `${old.length} pages from payloads, ${now.length} from fetch_text`;
  const i = old.findIndex((page, n) => !isDeepStrictEqual(page, now[n]));
  const fields = Object.keys({ ...old[i], ...now[i] }).filter((key) => !isDeepStrictEqual(old[i][key], now[i][key]));
  return `page ${i} (${old[i].url}): ${fields.join(", ")}`;
}

async function main() {
  process.loadEnvFile(path.resolve(ROOT, at === -1 ? ".env.local" : argv[at + 1]));
  const version = textVersion(ROOT);
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    // One server, so the client made read-only is the one the readers use.
    const db = await server.ssrLoadModule("/src/lib/db/index.ts");
    const text = await server.ssrLoadModule("/src/lib/measure/text.ts");
    const admin = db.dbAdmin();
    const tally = { sites: 0, domains: 0, pages: 0, mismatches: 0, derived: 0, unstorable: 0 };
    readOnly(admin, tally);

    const both = async (who, read) => {
      delete process.env.RK_TEXT_VERSION;
      const old = await read();
      process.env.RK_TEXT_VERSION = version;
      const now = await read();
      tally.pages += old.length;
      if (!isDeepStrictEqual(old, now)) {
        tally.mismatches += 1;
        console.log(`MISMATCH ${who}: ${difference(old, now)}`);
      }
    };

    const sites = await all(() => admin.from("sites").select("id").order("id"));
    for (const site of sites) {
      tally.sites += 1;
      await both(`site ${site.id}`, () => text.readMeasuredText({ siteId: site.id }));
    }
    const free = await all(() => admin.from("scans").select("domain").eq("tier", "free").order("id"));
    for (const domain of [...new Set(free.map((row) => row.domain))].sort()) {
      tally.domains += 1;
      await both(`domain ${domain}`, () => text.readDomainText(domain));
    }

    console.log(`text version ${version}: ${tally.sites} sites, ${tally.domains} free-scan domains, ${tally.pages} pages, ${tally.mismatches} mismatches`);
    console.log(`${tally.derived} rows a miss would keep, ${tally.unstorable} of them a column would refuse or change`);
    return tally.mismatches === 0 ? 0 : 1;
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
);
