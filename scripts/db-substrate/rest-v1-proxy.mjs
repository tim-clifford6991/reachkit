// scripts/db-substrate/rest-v1-proxy.mjs
//
// The gateway half of a Supabase project, reduced to the one thing the `db`
// vitest project needs from it.
//
// `@supabase/supabase-js`'s `createClient(url, key)` unconditionally builds
// its PostgREST client against `new URL("rest/v1", url).href` — the path a
// real project's Kong gateway routes to a bare PostgREST instance. This
// substrate has no Kong; PostgREST answers at its own root. Without this
// proxy every request `src/lib/db/index.ts`'s `db()` / `dbAdmin()` make —
// and every request `tests/db/rls.test.ts`'s own clients make — 404s with
// PGRST125 ("Invalid path specified in request URL").
//
// Listens on the documented `SUPABASE_URL` port, strips a leading
// `/rest/v1` from the path and forwards everything else — method, headers,
// query, body — to PostgREST. A path with no `/rest/v1` prefix is forwarded
// unchanged, so `curl http://127.0.0.1:3001/` (the health check `up.sh`
// polls) still answers.
import http from "node:http";

const UPSTREAM_HOST = process.env.POSTGREST_HOST || "127.0.0.1";
const UPSTREAM_PORT = Number(process.env.POSTGREST_PORT || 3002);
const LISTEN_HOST = process.env.PROXY_HOST || "127.0.0.1";
const LISTEN_PORT = Number(process.env.PROXY_PORT || 3001);

const server = http.createServer((req, res) => {
  const strippedUrl = req.url?.startsWith("/rest/v1")
    ? req.url.slice("/rest/v1".length) || "/"
    : req.url;

  const upstreamReq = http.request(
    {
      host: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: strippedUrl,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "rest-v1-proxy upstream error", message: err.message }));
  });

  req.pipe(upstreamReq);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`rest-v1-proxy: ${LISTEN_HOST}:${LISTEN_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT} (stripping /rest/v1)`);
});
