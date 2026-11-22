#!/usr/bin/env node
// scripts/backfill-citations.mjs — records `drafts.meta.citations` on stored pages written from a pack that lack
// it, with the matcher the daily write uses. 0¢: no vendor, no model, no database key; it reads an export and
// prints SQL that sets only that key.
//
// # Usage
//
//   node scripts/backfill-citations.mjs                              # prints the select
//   node scripts/backfill-citations.mjs --drafts drafts.json         # dry run: the counts
//   node scripts/backfill-citations.mjs --drafts drafts.json --sql   # prints the guarded updates
//
// This box's Node has no type stripping, so the repo's own Vite loads the TypeScript, as `scripts/reslug.mjs` does.
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argv = process.argv.slice(2);

const SELECT = [
  "select id, body_md, meta from drafts",
  "where body_md is not null and btrim(body_md) <> '' and meta ? 'pack' and not meta ? 'citations'",
  "order by id;",
].join("\n");

const quoted = (text) => `'${text.replaceAll("'", "''")}'`;

async function main() {
  const at = argv.indexOf("--drafts");
  if (at === -1 || at + 1 >= argv.length) {
    console.log(SELECT);
    return 0;
  }
  const rows = JSON.parse(readFileSync(argv[at + 1], "utf8"));
  if (!Array.isArray(rows)) throw new Error("--drafts is a JSON array of the rows the select returned.");
  const server = await createServer({
    configFile: false,
    root: ROOT,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: { alias: [{ find: /^@\//, replacement: `${path.join(ROOT, "src")}/` }] },
  });
  try {
    const { withCitations } = await server.ssrLoadModule("/src/lib/generate/citations.ts");
    const meta = (row) => (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta);
    const written = rows.flatMap((row) => {
      const citations = withCitations({ body_md: row.body_md, meta: meta(row) }).meta?.citations;
      return citations === undefined ? [] : [{ id: row.id, citations }];
    });
    if (!argv.includes("--sql")) {
      const sourced = written.filter(({ citations }) => citations.sentences.some((n) => n !== null)).length;
      console.log(`rows read: ${rows.length}\nwould write: ${written.length} (${sourced} with a sourced sentence)\nskipped, no readable pack: ${rows.length - written.length}`);
      return 0;
    }
    // Guarded on the key's absence, so a second run writes nothing; a slow row stops its batch of 100, not the rest.
    console.log("set statement_timeout = '5s';");
    for (let at = 0; at < written.length; at += 100) {
      console.log("begin;");
      for (const { id, citations } of written.slice(at, at + 100)) {
        console.log(`update drafts set meta = jsonb_set(meta, '{citations}', ${quoted(JSON.stringify(citations))}::jsonb) where id = ${quoted(id)} and not meta ? 'citations';`);
      }
      console.log("commit;");
    }
    return 0;
  } finally {
    await server.close();
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
);
