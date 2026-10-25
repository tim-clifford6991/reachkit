#!/usr/bin/env node
// Proves a change touched comments only: each file's esbuild output, with comments stripped, is byte-identical to the base ref's.
// `minifyWhitespace` because esbuild otherwise keeps a comment that sits inside an expression.
// esbuild erases types, so the TypeScript printer's comment-free output is compared too, or a type edit would pass.
// Usage: node scripts/comments-only.mjs [base-ref] [file ...]   (defaults: origin/main, every .ts/.tsx changed since it)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import ts from "typescript";

const [base = "origin/main", ...named] = process.argv.slice(2);
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files = named.length > 0 ? named : git("diff", "--name-only", "--diff-filter=M", base, "--", "*.ts", "*.tsx").split("\n").filter(Boolean);

const printer = ts.createPrinter({ removeComments: true });
const strip = (source, file) =>
  transformSync(source, { loader: file.endsWith(".tsx") ? "tsx" : "ts", format: "esm", legalComments: "none", minifyWhitespace: true, jsx: "preserve" }).code +
  printer.printFile(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));

let differs = 0;
for (const file of files) {
  const same = strip(git("show", `${base}:${file}`), file) === strip(readFileSync(file, "utf8"), file);
  if (!same) differs += 1;
  console.log(`${same ? "identical" : "DIFFERS  "} ${file}`);
}
console.log(`${files.length} file(s), ${differs} differ`);
process.exit(differs === 0 ? 0 : 1);
