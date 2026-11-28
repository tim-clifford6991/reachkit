// A reason that can stop a topic is checked once, where its check lives (docs/PROCESS.md rule 1): a file may use what
// only that home may use no more often than `oneCheck` in scripts/budgets.json allows it, and an allowance only falls.
import path from "node:path";

const PARTS = {
  // A duplicate: the same-question predicates are cluster.ts's alone to export or call.
  predicates: { kind: "use", home: ["src/lib/opportunities/cluster.ts"], names: ["oneQuestion", "liveTwin", "oneHead", "alreadyCovered", "closestKnown"], what: "a same-question predicate, which only src/lib/opportunities/cluster.ts may export or call" },
  // §6's refresh floor is compared in derive/known.ts alone; its constant's declaration is no comparison.
  floor: { kind: "ref", home: ["src/lib/opportunities/derive/known.ts"], names: ["REFRESH_MIN_AGE_DAYS"], what: "REFRESH_MIN_AGE_DAYS, which only src/lib/opportunities/derive/known.ts may compare against" },
  // Only Monday's pass ranks: the day, the jobs and the replan read what it committed.
  ranking: { kind: "import", only: /^src\/(?:lib\/generate|jobs)\/|^src\/lib\/scan\/replan\.ts$/, names: ["choose", "rankingOf", "liveTwinIds"], what: "the ranking (choose, rankingOf, liveTwinIds), which the day, the jobs and the replan may not import" },
};

const nameOf = (node) => (node?.type === "Identifier" ? node.name : node?.type === "MemberExpression" && !node.computed ? node.property.name : node?.type === "Literal" ? node.value : null);

export const oneCheckPerReason = {
  meta: { type: "problem", docs: { description: "A reason that can stop a topic is checked once, where its check lives." }, schema: [{ type: "object", additionalProperties: { type: "object", additionalProperties: { type: "integer", minimum: 0 } } }] },
  create(context) {
    const rel = path.relative(context.cwd, context.filename).split(path.sep).join("/");
    const allow = context.options[0] ?? {};
    const parts = Object.entries(PARTS).filter(([, p]) => !p.home?.includes(rel) && (p.only === undefined || p.only.test(rel)));
    const seen = new Map(parts.map(([key]) => [key, []]));
    const hit = (kind, node, name) => {
      for (const [key, p] of parts) if (p.kind === kind && p.names.includes(name)) seen.get(key).push(node);
    };
    const imported = (node, names) => names.forEach((name) => hit("import", node, name));
    return {
      CallExpression: (node) => hit("use", node, nameOf(node.callee)),
      ExportNamedDeclaration(node) {
        const d = node.declaration;
        for (const id of d?.type === "FunctionDeclaration" ? [d.id] : d?.type === "VariableDeclaration" ? d.declarations.map((v) => v.id) : []) hit("use", node, nameOf(id));
        for (const s of node.specifiers ?? []) hit("use", node, nameOf(s.exported));
      },
      Identifier(node) {
        const p = node.parent;
        if (p.type === "ImportSpecifier" || p.type === "ExportSpecifier" || (p.type === "VariableDeclarator" && p.id === node)) return;
        hit("ref", node, node.name);
      },
      ImportDeclaration(node) {
        if (node.importKind !== "type") imported(node, node.specifiers.flatMap((s) => (s.type === "ImportSpecifier" && s.importKind !== "type" ? [nameOf(s.imported)] : [])));
      },
      // `const { x } = await import("…")`, the lazy form this tree uses.
      ImportExpression(node) {
        const holder = node.parent?.type === "AwaitExpression" ? node.parent.parent : node.parent;
        if (holder?.type === "VariableDeclarator" && holder.id.type === "ObjectPattern") imported(node, holder.id.properties.map((p) => nameOf(p.key)));
      },
      "Program:exit"() {
        for (const [key, p] of parts) {
          const nodes = seen.get(key), cap = allow[key]?.[rel] ?? 0;
          if (nodes.length > cap) context.report({ node: nodes[cap], message: `${rel} has ${nodes.length} uses of ${p.what}; scripts/budgets.json oneCheck.${key} allows it ${cap}. Call the one check, never a copy.` });
        }
      },
    };
  },
};
