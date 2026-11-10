// The static pages' CSP lists each inline script by hash. Their HTML exists only after prerender, and
// `headers()` is read before it, so this deployment adapter (`adapterPath` in `next.config.ts`) adds
// one header route per page from the built HTML, then hands the build to the platform's own adapter.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STATIC_PAGE, STATIC_PAGES_SOURCE, inlineScriptHashes, withHashes } from "./static-csp.mjs";

const CSP = "content-security-policy";
const cspKey = (headers) => Object.keys(headers).find((key) => key.toLowerCase() === CSP);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every prerendered static HTML page, with its hashed policy. Throws rather than ship a page whose
 *  scripts its policy refuses. */
async function hashedPolicies(prerenders, policy) {
  if (/script-src[^;]*'unsafe-inline'/.test(policy)) throw new Error("static-csp: script-src must not allow 'unsafe-inline'");
  const pages = prerenders.filter((p) => p.fallback?.filePath?.endsWith(".html") && STATIC_PAGE.test(p.pathname));
  if (pages.length === 0) throw new Error("static-csp: no static page was prerendered");
  return Promise.all(
    pages.map(async (p) => ({ pathname: p.pathname, policy: withHashes(policy, inlineScriptHashes(await readFile(p.fallback.filePath, "utf8"))) })),
  );
}

/** One route per page, right after the shared one, with the shared one's other fields. */
function perPage(routes, pages, page) {
  const at = routes.findIndex((route) => route.source === STATIC_PAGES_SOURCE);
  if (at < 0) throw new Error(`static-csp: no header route for ${STATIC_PAGES_SOURCE}`);
  routes.splice(at + 1, 0, ...pages.map((p) => page(routes[at], p)));
  return routes[at];
}

async function platformAdapter() {
  const from = process.env.NEXT_ADAPTER_PATH;
  if (!from) return null;
  const mod = await import(pathToFileURL(createRequire(path.join(process.cwd(), "package.json")).resolve(from)).href);
  return mod.default ?? mod;
}

const SELF = fileURLToPath(import.meta.url);

const adapter = {
  name: "ReachKit static CSP",
  async modifyConfig(config, context) {
    const platform = await platformAdapter();
    const modified = platform?.modifyConfig ? await platform.modifyConfig(config, context) : config;
    return { ...modified, adapterPath: SELF };
  },
  async onBuildComplete(context) {
    const { routing, outputs, distDir } = context;
    const shared = routing.beforeMiddleware.find((route) => route.source === STATIC_PAGES_SOURCE);
    if (!shared) throw new Error(`static-csp: no header route for ${STATIC_PAGES_SOURCE}`);
    const pages = await hashedPolicies(outputs.prerenders, shared.headers[cspKey(shared.headers)]);

    // The platform's routing: the shared route stops matching these pages, so which of two matching
    // header routes a platform lets win never decides a page's policy.
    perPage(routing.beforeMiddleware, pages, (route, p) => ({
      ...route,
      source: p.pathname,
      sourceRegex: `^${escape(p.pathname)}(?:/)?$`,
      headers: { ...route.headers, [cspKey(route.headers)]: p.policy },
    }));
    const own = pages.map((p) => escape(p.pathname)).join("|");
    shared.sourceRegex = shared.sourceRegex.replace(/^\^/, `^(?!(?:${own})(?:/)?$)`);

    // `next start` reads the manifest on disk, compiles each `source` itself, and lets the later route win.
    const file = path.join(distDir, "routes-manifest.json");
    const manifest = JSON.parse(await readFile(file, "utf8"));
    perPage(manifest.headers, pages, (route, p) => ({
      ...route,
      source: p.pathname,
      headers: route.headers.map((h) => (h.key.toLowerCase() === CSP ? { ...h, value: p.policy } : h)),
    }));
    await writeFile(file, JSON.stringify(manifest));

    const platform = await platformAdapter();
    if (platform?.onBuildComplete) await platform.onBuildComplete(context);
  },
};

export default adapter;
