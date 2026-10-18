#!/usr/bin/env node
// Dated SPEC rulings in their own files (owner, 2026-10-18, #1525). Each new
// ruling is `docs/spec/decisions/YYYY-MM-DD-<issue>.md` (a `-<slug>` suffix
// when one issue rules twice on a day), headed by the `docs/SPEC.md` section
// it belongs to:
//
//   ---
//   section: §7
//   ---
//
//   2026-10-18  **What the ruling says** (owner, #1525). …
//
// Two pull requests that each add a ruling add two files, so they never touch
// the same lines. The lines already in SPEC.md stay where they are.
//
//   node scripts/spec-decisions.mjs                 the index, per section
//   node scripts/spec-decisions.mjs new <issue> <§n> [--date YYYY-MM-DD] [--slug s]
//                                                   writes the file's head
//   --root <dir>                                    another checkout
//
// `scripts/drift-audit.mjs` reads every file with `readDecisions`.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DECISIONS_DIR = "docs/spec/decisions";
const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d+)(?:-[a-z0-9-]+)?\.md$/;
const HEAD_RE = /^---\n([\s\S]*?)\n---\n/;

const isRealDate = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// The `## §n …` headings of SPEC.md, in order, by their `§n`.
export function specSections(spec) {
  return [...spec.matchAll(/^## (§\d+)\b(.*)$/gm)].map((m) => ({ id: m[1], title: `${m[1]}${m[2]}` }));
}

export function readDecisions(root) {
  const dir = path.join(root, DECISIONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => {
      const rel = `${DECISIONS_DIR}/${f}`;
      const text = readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
      const problems = [];
      const name = NAME_RE.exec(f);
      if (!name) problems.push("the file name is not YYYY-MM-DD-<issue>.md");
      else if (!isRealDate(+name[1], +name[2], +name[3])) problems.push("the date in the file name is not a real calendar date");
      const head = HEAD_RE.exec(text);
      const section = head ? /^section:\s*(§\d+)\s*$/m.exec(head[1])?.[1] ?? null : null;
      if (!section) problems.push("no `section: §n` head");
      const body = head ? text.slice(head[0].length).trim() : text.trim();
      if (!body) problems.push("the ruling is empty");
      return {
        file: rel,
        date: name ? `${name[1]}-${name[2]}-${name[3]}` : null,
        issue: name ? name[4] : null,
        section,
        body,
        problems,
      };
    });
}

export function index(root) {
  const spec = readFileSync(path.join(root, "docs/SPEC.md"), "utf8");
  const decisions = readDecisions(root);
  const out = [`# Dated rulings in ${DECISIONS_DIR}/, per docs/SPEC.md section`, ""];
  for (const s of specSections(spec)) {
    const here = decisions.filter((d) => d.section === s.id);
    if (!here.length) continue;
    out.push(`## ${s.title}`, "");
    for (const d of here) out.push(`- ${d.file} — ${d.body.split("\n")[0]}`);
    out.push("");
  }
  return out.join("\n");
}

export function create(root, { issue, section, date, slug }) {
  const name = `${date}-${issue}${slug ? `-${slug}` : ""}.md`;
  if (!NAME_RE.test(name)) throw new Error(`not a decision file name: ${name}`);
  const dir = path.join(root, DECISIONS_DIR);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  if (existsSync(file)) throw new Error(`${DECISIONS_DIR}/${name} exists; pass --slug`);
  writeFileSync(file, `---\nsection: ${section}\n---\n\n${date}  (owner, #${issue}) \n`);
  return `${DECISIONS_DIR}/${name}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const at = argv.indexOf(name);
    return at < 0 ? undefined : argv.splice(at, 2)[1];
  };
  const root = path.resolve(flag("--root") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  if (argv[0] === "new") {
    const date = flag("--date") ?? new Date().toISOString().slice(0, 10);
    const slug = flag("--slug");
    const [, issue, section] = argv;
    if (!/^\d+$/.test(issue ?? "") || !/^§\d+$/.test(section ?? "")) {
      console.error("usage: node scripts/spec-decisions.mjs new <issue> <§n> [--date YYYY-MM-DD] [--slug s]");
      process.exit(2);
    }
    console.log(create(root, { issue, section, date, slug }));
  } else {
    console.log(index(root));
  }
}
