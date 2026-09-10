// tests/ui/layout/auth-stub.ts — BUILD §13 (#468)
//
// The two Supabase Auth endpoints the built app calls while the sweep
// renders, stood in front of the db substrate.
//
// **Why a stub.** Since #468 the middleware and `currentSession()` ask
// Supabase who a request belongs to — `getUser()`, which is
// `GET {SUPABASE_URL}/auth/v1/user` with the access token out of the
// `@supabase/ssr` session cookie. The substrate (`scripts/db-substrate/`)
// is PostgREST and nothing else: it has no GoTrue, so without this every
// `(account)` address would answer `/signin` and the sweep would measure
// the sign-in prompt and call it the screen — the failure #192 left a
// marker for.
//
// **What it answers, and what it forwards.** `GET /auth/v1/user` for a
// token it minted, `401` for any other; `POST /auth/v1/logout` with `204`.
// Every other request — `/rest/v1/**` above all — is piped unchanged to
// the substrate the job already started, so the built app's database
// reads are exactly what they were. `globalSetup` points `SUPABASE_URL` at
// this server before `next build`, and the build and the app inherit it.
//
// **What it does not prove.** The sign-in path itself — `generateLink`,
// the mail, `/auth/confirm`, `verifyOtp` — is not exercised end to end
// here, because there is no GoTrue to issue or verify a link against. The
// unit suites (`tests/account/identity/**`, `tests/app/signin/**`) own
// that. What this file keeps honest is the half the sweep needs: a
// session cookie in the exact shape `@supabase/ssr` writes, read back by
// the real client, verified by a server rather than trusted.
import { randomBytes } from "node:crypto";
import http from "node:http";

/** `@supabase/ssr`'s own limit on one cookie's encoded value
 *  (`utils/chunker.js`, `MAX_CHUNK_SIZE`); a longer session is split into
 *  `.0`, `.1`, … chunks. */
const MAX_CHUNK_SIZE = 3180;

/** How long a minted session stays valid, in **real** seconds. The sweep's
 *  frozen clock (`RK_FIXED_NOW`) never reaches auth-js, which compares
 *  `expires_at` against `Date.now()` and refreshes a session inside 90 s of
 *  it — so the window is generous and in real time, and no refresh (which
 *  this stub does not answer) is ever attempted. */
const SESSION_SECONDS = 24 * 60 * 60;

/** `sb-{first label of the host}-auth-token` — supabase-js's
 *  `defaultStorageKey`, which `@supabase/ssr` uses as the cookie name. */
export function authCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** The `Cookie` header value `@supabase/ssr` would read `session` from:
 *  `base64-` + base64url(JSON), chunked the way `createChunks` does. */
export function sessionCookieHeader(name: string, session: object): string {
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  if (value.length <= MAX_CHUNK_SIZE) return `${name}=${value}`;
  const chunks: string[] = [];
  for (let i = 0; i * MAX_CHUNK_SIZE < value.length; i++) {
    chunks.push(`${name}.${i}=${value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE)}`);
  }
  return chunks.join("; ");
}

interface StubUser {
  id: string;
  aud: "authenticated";
  role: "authenticated";
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuthStub {
  /** The URL the app is given as `SUPABASE_URL`. */
  readonly url: string;
  /** Mints a session for one account and returns the `Cookie` header that
   *  carries it. */
  sessionCookieFor(account: { userId: string; email: string }): string;
  close(): Promise<void>;
}

function forward(upstream: URL, req: http.IncomingMessage, res: http.ServerResponse): void {
  const headers = { ...req.headers, host: upstream.host };
  const out = http.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port,
      method: req.method,
      path: req.url,
      headers,
    },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    }
  );
  out.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "auth-stub upstream error", message: err.message }));
  });
  req.pipe(out);
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Starts the stub on a free loopback port, forwarding to `upstream`. */
export async function startAuthStub(upstream: string): Promise<AuthStub> {
  const target = new URL(upstream);
  const sessions = new Map<string, StubUser>();

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://stub").pathname;
    if (pathname === "/auth/v1/user" && req.method === "GET") {
      const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
      const user = bearer === undefined ? undefined : sessions.get(bearer);
      if (user === undefined) {
        json(res, 401, { code: "bad_jwt", error_code: "bad_jwt", msg: "invalid JWT" });
        return;
      }
      json(res, 200, user);
      return;
    }
    if (pathname === "/auth/v1/logout" && req.method === "POST") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (pathname.startsWith("/auth/v1/")) {
      json(res, 404, { code: "not_found", msg: "tests/ui/layout/auth-stub.ts answers /user and /logout only" });
      return;
    }
    forward(target, req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address !== "object") {
    throw new Error("tests/ui/layout/auth-stub.ts: the stub did not get a port");
  }
  const url = `http://127.0.0.1:${address.port}`;
  const cookieName = authCookieName(url);

  return {
    url,
    sessionCookieFor(account) {
      const accessToken = randomBytes(32).toString("base64url");
      const user: StubUser = {
        id: account.userId,
        aud: "authenticated",
        role: "authenticated",
        email: account.email,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      sessions.set(accessToken, user);
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
      return sessionCookieHeader(cookieName, {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: SESSION_SECONDS,
        expires_at: expiresAt,
        refresh_token: randomBytes(16).toString("base64url"),
        user,
      });
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
