// The viewer's delivery mechanism: a local HTTP server, read-only by
// default.
//
// Not a static export and not a route inside the product — keeping the
// console out of `src/` avoids the product's design-system and page gates
// entirely, and keeps the read-only promise structural rather than
// aspirational.
//
// As of ADR-003 there is exactly one exception, and it is opt-in: started
// with `--write`, the server additionally answers POST /api/status/:id,
// which rewrites one artifact's front-matter `status:` field and nothing
// else. Without the flag that route is never constructed and the method
// guard below rejects everything but GET, so "there is no write endpoint to
// forget to remove" still holds for every default invocation.

import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { loadConfig } from "./config.mjs";
import { extract } from "./extract/index.mjs";
import { check, RULES, RULE_TEXT } from "./check/index.mjs";
import { tabsFor } from "./projects.mjs";
import { doctrineVersion, corpusVersion } from "./upgrade.mjs";
import { repoHead } from "./extract/git.mjs";
import { writeStatus, StatusWriteError } from "./status-write.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "ui/console.template.html");
const MERMAID_PATH = join(HERE, "ui/vendor/mermaid.min.js");

// Read and gzipped lazily, on the first request that needs it, then cached
// in memory — the console's own copy of mermaid never changes at runtime, so
// there is nothing to cache-invalidate. Gzipping the raw bytes once here
// (rather than per request, as sendBody() does for every other route) avoids
// re-compressing the same 3.5 MB on every single load of the page. The ETag
// is static — just the byte length, since this asset only ever changes when
// the vendored file itself is replaced, i.e. on server restart — so a
// client that already has it gets a 304 instead of the body at all.
let mermaidRaw = null;
let mermaidGz = null;
let mermaidEtag = null;
function mermaidAsset() {
  if (mermaidRaw === null) {
    mermaidRaw = readFileSync(MERMAID_PATH);
    mermaidGz = gzipSync(mermaidRaw);
    mermaidEtag = `"mermaid-${mermaidRaw.length}"`;
  }
  return { raw: mermaidRaw, gz: mermaidGz, etag: mermaidEtag };
}

/**
 * Embed a JSON payload into a <script> safely.
 *
 * A conflict row in a real corpus contains the literal string `</script>`.
 * Interpolated raw, it closes the tag early and destroys the page — this cost
 * real time once and is recorded so it is not rediscovered. JSON.parse of a
 * string literal is also markedly faster than parsing a multi-megabyte object
 * literal, which matters now that document bodies are no longer truncated.
 */
export function embed(value) {
  return JSON.stringify(JSON.stringify(value))
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * The newest mtime under a directory, recursively.
 *
 * The parse cache's freshness key: as long as nothing under `docsRoot`
 * changed, the cached graph is still correct. A missed stat (file vanished
 * mid-scan) or an unreadable directory just contributes 0 rather than
 * throwing — the scan exists to invalidate a cache, not to audit a
 * filesystem, and a corpus that never settles is not this function's
 * problem.
 */
function scanMaxMtime(dir) {
  let max = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const m = scanMaxMtime(p);
      if (m > max) max = m;
    } else if (e.isFile()) {
      try {
        const st = statSync(p);
        if (st.mtimeMs > max) max = st.mtimeMs;
      } catch { /* raced a delete; ignore */ }
    }
  }
  return max;
}

/**
 * Config plus the freshness key derived from it, computed once per request.
 *
 * `key` folds in the repo HEAD as well as the docs tree's mtime: Task 3's
 * extractor reads git when `config.code` is set, so a commit to code must
 * invalidate the parse cache even though nothing under `docsRoot` changed.
 * `repoHead` is only ever called when `config.code` is non-null — a
 * `code: null` corpus must never shell out to git, the same rule the
 * extractor itself already follows.
 */
export function projectState(root) {
  const { config, source } = loadConfig(root);
  const mtime = scanMaxMtime(join(root, config.docsRoot));
  // Must resolve HEAD against the same repository the extractor reads
  // (readRepo(join(projectRoot, cfg.code.root)) in extract/index.mjs) —
  // repoHead(root) alone disagreed whenever code.root pointed somewhere
  // other than the project root, so a commit there never invalidated the
  // cache.
  const head = config.code ? repoHead(join(root, config.code.root)) : null;
  const key = `${mtime}-${head || "nogit"}`;
  return { config, source, mtime, key };
}

const PARSE_CACHE = new Map(); // projectRoot -> { key, built }

/**
 * Parse one project and run the checker over it — cached on the corpus's own
 * mtime, so repeat requests against an unchanged corpus cost one recursive
 * stat scan, not a full re-read-and-reparse of every file.
 *
 * `state`, when given, must be the return of `projectState(root)` for the
 * same root — passing it lets a caller that already computed it (to build an
 * ETag, say) avoid scanning the directory tree twice in one request.
 */
export function buildProject(root, state) {
  const { config, source, key } = state || projectState(root);
  const cached = PARSE_CACHE.get(root);
  if (cached && cached.key === key) return cached.built;
  const graph = extract(root, config);
  const verdict = check(graph, config, root);
  graph.check = { findings: verdict.findings, bySeverity: verdict.bySeverity, notices: verdict.notices, notRun: verdict.notRun };
  const built = { config, source, graph, verdict };
  PARSE_CACHE.set(root, { key, built });
  return built;
}

/**
 * The payload sent to the browser never carries document bodies (change 5a.1)
 * — only `/api/doc/:id` does, on demand. Strips a shallow clone so the cached
 * graph object itself (and whatever check.mjs read off it before this ever
 * runs) is never mutated.
 *
 * Same reasoning extends to `code.commits[].files`: server-side, the rules in
 * check/index.mjs need every file a commit touched (untraced-change has to
 * see the ones that AREN'T anchored, to say a commit touched governed code
 * with no anchor covering it). The client never needs that — the viewer only
 * ever lists a commit's files against one artifact's own anchored set — so
 * each commit is sent with its full count (`n`) but only the files that fall
 * under SOME blueprint's anchors, dropping the rest, which on a real corpus
 * is most of a commit's file list on every request.
 */
function forClient(graph) {
  // 0.11.0: the rests-on rows (`a`) stay server-side too — the checker
  // reads them, the viewer never does, and on the second live corpus they
  // were 190 KB of claim text riding every page load.
  const client = { ...graph, nodes: graph.nodes.map(({ b, a, ...rest }) => rest) };
  if (graph.code?.present) {
    const anchoredFiles = new Set(Object.values(graph.code.anchors).flatMap((a) => a.files));
    client.code = {
      ...graph.code,
      commits: graph.code.commits.map((c) => ({
        h: c.h, d: c.d, s: c.s, wo: c.wo,
        n: c.files.length,
        files: c.files.filter((f) => anchoredFiles.has(f)),
      })),
      // The import edge list stays server-side (rule: "never the import edge
      // list") — the client gets a count. `anchors[id].blast`/`.routes` ride
      // along unchanged inside `...graph.code` above (they're per-anchor
      // scalars/small arrays, not the edge list this line trims). This is a
      // deliberate asymmetry with `--json`: that flag ships the raw graph
      // straight from extract(), full import list included — a script piping
      // it somewhere is presumed to want the real data; a browser tab is not.
      index: {
        files: graph.code.index.files,
        imports: graph.code.index.imports.length,
        unresolved: graph.code.index.unresolved,
        routes: graph.code.index.routes,
      },
    };
  }
  return client;
}

export function renderPage(root, tabs, index, state, opts) {
  const { config, graph, verdict } = buildProject(root, state);
  const tmpl = readFileSync(TEMPLATE, "utf8");
  if (!tmpl.includes("/*__GRAPH__*/") || !tmpl.includes("/*__APP__*/")) {
    throw new Error("viewer template is missing an injection marker");
  }

  const app = {
    write: !!(opts && opts.write),
    // The per-type status vocabularies the write control offers. Sent
    // whether or not writing is enabled — the viewer also uses them to say
    // "this value is off-grammar" while read-only, and they are four short
    // arrays, not a payload worth gating.
    statuses: config.statuses || {},
    project: tabs[index],
    projects: tabs.map((t, i) => {
      if (i === index) {
        return { ...t, total: graph.counts.total, errors: verdict.bySeverity.error };
      }
      // Sibling tabs are labels only — each project parses independently and
      // is not parsed until it is opened.
      return { name: t.name, path: t.path, registered: t.registered };
    }),
    index,
    doctrineVersion: `doctrine ${doctrineVersion()} · corpus ${corpusVersion(root)}`,
    docsRoot: config.docsRoot,
    charter: config.charter,
    structureMap: config.structureMap,
    schemaPath: config.schema?.path || null,
    rules: RULES.map((id) => ({ id, severity: config.checks.severity[id], text: RULE_TEXT[id] })),
    notice: corpusVersion(root) === doctrineVersion() ? null : {
      title: `This corpus is stamped doctrine ${corpusVersion(root)}, the installed doctrine is ${doctrineVersion()}.`,
      body: "Run `factory upgrade` to migrate it forward. Until then some findings may be about a grammar this corpus was never written against.",
    },
  };

  // The replacements MUST be functions. With a string replacement,
  // String.replace interprets `$&`, `` $` ``, `$'` and `$1` inside it — and a
  // corpus full of shell and template-literal snippets contains those
  // sequences, which splices unescaped document text into the page and
  // reintroduces exactly the `</script>` break the escaping exists to
  // prevent. A function replacement disables that substitution entirely.
  return tmpl
    .replace("/*__GRAPH__*/", () => `JSON.parse(${embed(forClient(graph))})`)
    .replace("/*__APP__*/", () => `JSON.parse(${embed(app)})`);
}

/**
 * Read one artifact's file content, path-validated against the project's
 * docs root — no traversal, even though the only route into this function is
 * an id the parser itself discovered by walking that same root (an id that
 * doesn't resolve to a known node never reaches the readFileSync call at
 * all). Belt and suspenders: the resolve+relative check is what actually
 * guarantees "no traversal" independent of that lookup ever staying correct.
 */
function resolveDocPath(root, config, file) {
  const docsRoot = resolve(join(root, config.docsRoot));
  const target = resolve(join(docsRoot, file));
  const rel = relative(docsRoot, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw Object.assign(new Error("refused: path escapes the docs root"), { code: "ESCAPE" });
  }
  return target;
}

function readDocFile(root, config, file) {
  return readFileSync(resolveDocPath(root, config, file), "utf8");
}

/**
 * Write a response body, gzip-compressed when the client's Accept-Encoding
 * allows it. `Vary: accept-encoding` so anything caching this response (a
 * browser's disk cache, a proxy) does not serve the compressed bytes to a
 * client that never said it could decode them.
 */
function sendBody(req, res, status, headers, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const accepts = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  if (accepts && buf.length > 0) {
    res.writeHead(status, { ...headers, "content-encoding": "gzip", vary: "accept-encoding" });
    return res.end(gzipSync(buf));
  }
  res.writeHead(status, { ...headers, vary: "accept-encoding" });
  res.end(buf);
}

const DOC_ROUTE = /^\/api\/doc\/([^/]+)$/;
const STATUS_ROUTE = /^\/api\/status\/([^/]+)$/;

/** Read a small JSON request body, refusing anything oversized before it is
 *  buffered — a status write is a two-key object; nothing legitimate reaches
 *  even a kilobyte. */
function readJsonBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let over = false;
    req.on("data", (c) => {
      if (over) return;
      size += c.length;
      if (size > limit) {
        over = true;
        // Drained rather than destroyed: killing the socket here means the
        // client sees a connection reset instead of the 413 explaining why,
        // which is a worse answer than the one we already have.
        req.resume();
        reject(Object.assign(new Error("refused: request body too large"), { code: "TOOBIG" }));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (over) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("refused: body is not JSON"), { code: "BADJSON" }));
      }
    });
    req.on("error", reject);
  });
}

/**
 * POST /api/status/:id — the console's only write, reachable only when the
 * server was started with `--write` (createHandler's method guard is what
 * enforces that; this function is never called otherwise).
 *
 * The checks run in this order, and each is here for its own reason:
 *
 *   1. Origin. A page on any origin can POST to 127.0.0.1 from the reader's
 *      own browser; without this, opening a hostile tab while the console
 *      runs would let it flip statuses. A same-origin fetch sends either no
 *      Origin or this server's own, so requiring that costs the real client
 *      nothing. This is the one check that has nothing to do with the
 *      corpus and everything to do with the console being on localhost.
 *   2. Content type. Rejecting anything but application/json is what keeps
 *      the route outside the set a simple HTML form can reach at all.
 *   3. The id resolves to a node the parser itself found — so the file path
 *      written is one the extractor produced, never a string from the wire.
 *   4. The value is in this artifact type's declared vocabulary. The grammar
 *      already names them (config.statuses[type]); writing an off-grammar
 *      status would have the checker report the file the console just wrote.
 *   5. Optimistic concurrency, inside status-write.mjs: the caller says what
 *      it believes the current status is, and a mismatch is refused.
 */
async function handleStatusWrite(req, res, url, root, projectIndex) {
  const send = (status, obj) =>
    sendBody(req, res, status, { "content-type": "application/json; charset=utf-8" }, JSON.stringify(obj));

  const match = url.pathname.match(STATUS_ROUTE);
  if (!match) return send(404, { error: "no such write route" });

  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host || "";
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { ok = false; }
    if (!ok) return send(403, { error: "refused: cross-origin write" });
  }
  if (!/^application\/json\b/.test(req.headers["content-type"] || "")) {
    return send(415, { error: "refused: expected content-type application/json" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return send(e.code === "TOOBIG" ? 413 : 400, { error: e.message });
  }

  const id = decodeURIComponent(match[1]);
  const { graph, config } = buildProject(root);
  const node = graph.nodes.find((n) => n.i === id);
  if (!node) return send(404, { error: `no such artifact: ${id}` });

  const vocab = (config.statuses && config.statuses[node.y]) || [];
  const to = String(body.status ?? "");
  if (!vocab.includes(to)) {
    return send(422, {
      error: `refused: ${JSON.stringify(to)} is not a status for a ${node.y}`,
      allowed: vocab,
    });
  }

  let target;
  try {
    target = resolveDocPath(root, config, node.f);
  } catch (e) {
    return send(400, { error: e.message });
  }

  try {
    writeStatus(target, body.from ?? node.s ?? null, to);
  } catch (e) {
    if (e instanceof StatusWriteError) {
      return send(e.code === "CONFLICT" ? 409 : 422, { error: e.message, code: e.code });
    }
    return send(500, { error: e.message });
  }

  // The parse cache keys on the docs tree's newest mtime, which the write we
  // just made has moved — but two writes inside one millisecond would not,
  // so drop this project's entry outright rather than trust the key.
  PARSE_CACHE.delete(root);
  const fresh = buildProject(root).graph.nodes.find((n) => n.i === id);
  return send(200, { id, status: to, node: fresh ? { i: fresh.i, y: fresh.y, s: fresh.s, t: fresh.t } : null, p: projectIndex });
}


/**
 * The console's whole HTTP surface, factored out of `serve()` so a test can
 * bind it to an ephemeral port against a hand-built `tabs` array — no
 * `~/.factory/projects.json` registry, no browser-open — without duplicating
 * the routing.
 */
export function createHandler(tabs, handlerOpts) {
  const write = !!(handlerOpts && handlerOpts.write);

  return (req, res) => {
    // Read-only by construction: without --write, nothing but GET is
    // answered and the POST branch below is unreachable.
    if (req.method !== "GET" && !(write && req.method === "POST")) {
      res.writeHead(405, { "content-type": "text/plain", allow: write ? "GET, POST" : "GET" });
      return res.end(write
        ? "The console answers GET, and POST /api/status/:id only.\n"
        : "The console is read-only. Agents remain the only writers.\n");
    }
    const url = new URL(req.url, "http://localhost");
    const i = Math.min(Math.max(parseInt(url.searchParams.get("p") ?? "0", 10) || 0, 0), tabs.length - 1);
    const root = tabs[i].root;

    try {
      if (req.method === "POST") {
        return handleStatusWrite(req, res, url, root, i);
      }

      const docMatch = url.pathname.match(DOC_ROUTE);
      if (docMatch) {
        const id = decodeURIComponent(docMatch[1]);
        const { graph, config } = buildProject(root);
        const node = graph.nodes.find((n) => n.i === id);
        if (!node) {
          return sendBody(req, res, 404, { "content-type": "text/plain; charset=utf-8" }, `no such artifact: ${id}\n`);
        }
        let content;
        try {
          content = readDocFile(root, config, node.f);
        } catch (e) {
          const status = e.code === "ESCAPE" ? 400 : 404;
          return sendBody(req, res, status, { "content-type": "text/plain; charset=utf-8" }, `${e.message}\n`);
        }
        return sendBody(req, res, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" }, content);
      }

      if (url.pathname === "/mermaid.min.js") {
        const asset = mermaidAsset();
        if (req.headers["if-none-match"] === asset.etag) {
          res.writeHead(304, { etag: asset.etag, vary: "accept-encoding" });
          return res.end();
        }
        const headers = {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=86400",
          etag: asset.etag,
          vary: "accept-encoding",
        };
        const accepts = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
        if (accepts) {
          res.writeHead(200, { ...headers, "content-encoding": "gzip" });
          return res.end(asset.gz);
        }
        res.writeHead(200, headers);
        return res.end(asset.raw);
      }

      if (url.pathname === "/api/graph") {
        const state = projectState(root);
        const etag = `"j${i}-${state.key}"`;
        if (req.headers["if-none-match"] === etag) {
          res.writeHead(304, { etag, vary: "accept-encoding" });
          return res.end();
        }
        const { graph } = buildProject(root, state);
        return sendBody(req, res, 200, { "content-type": "application/json; charset=utf-8", etag }, JSON.stringify(forClient(graph)));
      }

      if (url.pathname !== "/") {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("not found\n");
      }

      const state = projectState(root);
      const etag = `"h${i}-${state.key}"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { etag, vary: "accept-encoding" });
        return res.end();
      }
      const html = renderPage(root, tabs, i, state, { write });
      return sendBody(req, res, 200, { "content-type": "text/html; charset=utf-8", etag }, html);
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`the console refused to render this project:\n\n${e.message}\n`);
    }
  };
}

export function serve(root, { port = 4319, open = true, write = false } = {}) {
  const tabs = tabsFor(root);
  if (!tabs.length) throw new Error(`${root} has no sdlc-factory/ — run /factory-init there first`);

  const server = createServer(createHandler(tabs, { write }));

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      console.log(`factory console · ${tabs.length} project${tabs.length === 1 ? "" : "s"} · ${url}`);
      for (const [i, t] of tabs.entries()) console.log(`  ${i === 0 ? "→" : " "} ${t.name.padEnd(22)} ${t.path}${t.registered ? "" : "   (unregistered)"}`);
      // Every corpus and config is re-read per request (dogfood finding 3: a
      // stale process kept validating against a doctrine version that had
      // already moved on) — but this process's own code, once loaded, never
      // is. Naming the version here is the honest fix: a full staleness
      // guard is out of scope, so say what's running and how to fix it.
      console.log(`doctrine ${doctrineVersion()} — restart the console after upgrading; it re-reads corpora per request, never its own code.`);
      if (write) {
        console.log("\nWRITE ENABLED (--write) — this console may rewrite one field: an artifact's");
        console.log("front-matter `status:`. Nothing else in a corpus is writable from a browser.");
        console.log("Restart without --write to go back to read-only. ctrl-c to stop.");
      } else {
        console.log("\nread-only. ctrl-c to stop.");
      }
      if (open) {
        import("node:child_process").then(({ spawn }) => {
          const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          try { spawn(cmd, [url], { stdio: "ignore", detached: true }).unref(); } catch { /* no browser, fine */ }
        });
      }
      resolve(server);
    });
  });
}
