#!/usr/bin/env node
// A daisyUI class whose module is not in tailwind.css include: ships no CSS, so the screen renders unstyled.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const CSS = "src/ui/tailwind.css";
const COMPONENTS = "node_modules/daisyui/components";
const CLASS_TOKEN = /^[a-z0-9!:\[\]\/\.\-_%()#&*=,>@~+]+$/;

/** Every class each daisyUI component file defines, read from the installed package so an upgrade updates the map. */
export function daisyClassModules(root) {
  const dir = path.join(root, COMPONENTS);
  const owners = new Map();
  if (!existsSync(dir)) return owners;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
    const name = file.slice(0, -4);
    const css = readFileSync(path.join(dir, file), "utf8");
    for (const m of css.matchAll(/(?<![\w\\-])\.(?:[a-z0-9]+\\:)*([a-z][a-z0-9-]*)/g)) {
      if (!owners.has(m[1])) owners.set(m[1], new Set());
      owners.get(m[1]).add(name);
    }
  }
  return owners;
}

/** The `include:` list and the `@source` globs' base folders, from the stylesheet. */
export function readTailwindCss(text) {
  const block = text.match(/@plugin\s+"daisyui"\s*\{([^}]*)\}/)?.[1] ?? "";
  const list = block.match(/include:([^;]*);/)?.[1] ?? "";
  const include = new Set(list.split(",").map((s) => s.trim()).filter(Boolean));
  const sources = [...text.matchAll(/@source\s+"([^"]+)"/g)].map((m) => m[1].split("/**")[0]);
  return { include, sources };
}

/** Class-like tokens in a file's string literals; a bare word counts only in a `className` or beside other tokens. */
export function classCandidates(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const tokens = node.text.split(/\s+/).filter(Boolean);
      const inClassName = ts.isJsxAttribute(node.parent) && node.parent.name.getText(sf) === "className";
      if (tokens.every((t) => CLASS_TOKEN.test(t))) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        for (const token of tokens) {
          const name = token.replace(/^.*:/, "").replace(/^!|!$/g, "");
          if (name.includes("-") || inClassName || tokens.length > 1) out.push({ name, line });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** A daisyUI class used under `@source` whose every defining module is left out of `include:`, so its CSS is never generated. */
export function daisyIncludeFindings(root, files) {
  const css = path.join(root, CSS);
  if (!existsSync(css)) return [`${CSS} is missing`];
  const { include, sources } = readTailwindCss(readFileSync(css, "utf8"));
  const owners = daisyClassModules(root);
  if (owners.size === 0) return [`${COMPONENTS} is missing; run npm install`];
  const bases = sources.map((s) => path.relative(root, path.resolve(path.dirname(css), s)) + "/");
  const findings = [];
  for (const rel of files.filter((f) => /\.tsx?$/.test(f) && bases.some((b) => f.startsWith(b)))) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    for (const { name, line } of classCandidates(rel, readFileSync(abs, "utf8"))) {
      const modules = owners.get(name);
      if (modules && ![...modules].some((m) => include.has(m))) {
        findings.push(`${rel}:${line} uses daisyUI "${name}" but ${CSS} include: has no ${[...modules].join(" or ")}`);
      }
    }
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = spawnSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).stdout.split("\n");
  const findings = daisyIncludeFindings(root, files);
  for (const finding of findings) console.error(finding);
  if (findings.length) process.exit(1);
  console.log("daisy-include: every daisyUI class used is in include:");
}
