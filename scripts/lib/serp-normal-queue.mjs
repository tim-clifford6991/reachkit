// SPEC §6 "Google reads are queued": live and high-priority Google SERPs link only google.com/goto redirects, so every
// other read takes the normal queue. A read that must answer in seconds says why on an eslint-disable line beside it.
const MESSAGE =
  "Google reads are queued (SPEC §6): a live or high-priority SERP links only google.com/goto. Use the normal queue, or say why on an eslint-disable line.";
const LIVE_KEYS = new Set(["mode", "serpMode"]);
const HIGH_KEYS = new Set(["priority", "serpPriority"]);
// Labs and OnPage are live-only endpoints that return no Google results page.
const NO_SERP = /src\/lib\/vendors\/dataforseo\/(labs|rendered)\.ts$/;

/** A string literal, through `as const` and `satisfies`. */
function literalOf(node) {
  while (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") node = node.expression;
  return node.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

export const serpNormalQueue = {
  meta: { type: "problem", docs: { description: MESSAGE }, schema: [] },
  create(context) {
    if (NO_SERP.test(context.filename.replaceAll("\\", "/"))) return {};
    return {
      Property(node) {
        if (node.computed || node.key.type !== "Identifier") return;
        const value = literalOf(node.value);
        if ((LIVE_KEYS.has(node.key.name) && value === "live") || (HIGH_KEYS.has(node.key.name) && value === "high")) {
          context.report({ node, message: MESSAGE });
        }
      },
      CallExpression(node) {
        const [, mode] = node.arguments;
        if (node.callee.type === "Identifier" && node.callee.name === "callEndpoint" && mode && literalOf(mode) === "live") {
          context.report({ node: mode, message: MESSAGE });
        }
      },
    };
  },
};
