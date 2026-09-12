// src/lib/config/env.ts
//
// BP-005 `## Public interface`:
//   "export const env: Readonly<Env>   // parsed and validated at module
//   load; a missing binding is a boot failure, not a runtime undefined"
// BP-005 `## Error & edge behavior`:
//   "`env` throws at boot on a missing or malformed binding; there is no
//   default and no fallback, so a deployment cannot start half-configured."
// BP-005 "imports nothing" — this module imports `zod`, and (issue #315)
// `./now` for `isRealDeployment()`: the corpus already owns one definition
// of "a deployment customers reach", and the jobs invariant below asks the
// same question the clock invariant asks. `./now` is a sibling that itself
// imports nothing, so the module still sits at the bottom of the graph.
import { z } from "zod";
import { isRealDeployment } from "./now";

// `BUILD.md` §15, verbatim:
//   "SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID RESEND_API_KEY
//   MAIL_FROM DATAFORSEO_LOGIN DATAFORSEO_PASSWORD ANTHROPIC_API_KEY
//   NANO_API_KEY (optional, defaults to ANTHROPIC_API_KEY)
//   INNGEST_SIGNING_KEY INNGEST_EVENT_KEY IP_HASH_SALT KILL_SWITCH
//   OWNER_EMAILS HOSTED_EDGE_CNAME_TARGET NEXT_PUBLIC_APP_URL";
//   "`DATABASE_URL` is required only by migration tooling."
// `HOSTED_EDGE_CNAME_TARGET` is the one binding BP-005's `## Public
// interface` states the derivation for: "the hostname a customer points
// `content.{their-domain}` at … It is one deployment-scoped hostname, so
// it is a binding rather than a constant."
//
// BP-005 decision 6: three of §15's rows above are bound differently, because
// the deployment target is the existing Vercel project `reachkit` and its
// secrets are write-only. §15 itself is upstream source text and stays cited,
// not edited — this schema is what actually binds. 6a:
// `SUPABASE_SERVICE_ROLE` is retired; the schema's (and the platform's) only
// name is `SUPABASE_SERVICE_ROLE_KEY`, no alias. 6b: `NANO_API_KEY` is the
// schema's one optional member, resolved to `ANTHROPIC_API_KEY` when absent
// inside `parseEnv()` below, before `env` is constructed — see `type Env`
// two lines down for how the member's type stays a required `string` either
// way. 6c: `DATABASE_URL` is not a member of this schema at all — no module
// under `src/` reads it; it is the migration and test tooling's binding.
//
// **The jobs platform's two bindings** (issue #315). `BUILD.md` §15 names
// `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`; the 2026-09-05 ruling kept
// them out of this schema as "the SDK's own bindings", and the cost of that
// was a deployment that starts, serves every screen, and cannot run a single
// job — the hourly crons never tick and nothing says so. They join the
// schema here, server-only, and #315 reverses that ruling. The SDK still
// reads them from `process.env` for itself: `src/jobs/client.ts` passes
// neither, and says why. What this schema adds is the declaration, the
// validation, and the refusal below.
//
// They are `.optional()` at the schema level for the reason `RK_FIXED_NOW`
// is not a member at all: the required set is what *every* process must
// carry, and the processes that are not deployments — a local `next dev`, a
// local production build, the layout suite's build and server in CI — run
// no jobs and reach no queue. Requiring the keys there would fail those
// boots over a vendor they never call. What a real deployment must carry is
// asserted instead by `assertJobsBindings()` below, which the one boot path
// calls: on Vercel, a missing key does not start the process.
//
// No `.default(...)` and no other `.optional()` anywhere in this schema
// (WO-005 step 2 / file plan: "No default, no fallback.") — a missing or
// malformed binding fails `safeParse` and `parseEnv()` below throws. Every
// `.optional()` here is a named exception: `NANO_API_KEY` (decision 6b,
// resolved to a required member before any caller sees it) and the two jobs
// bindings above (required of a real deployment by the boot invariant).
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  // **The mailbox every ReachKit mail comes from** (issue #81). §15 names
  // it; until this member existed the address was derived in the vendor
  // seam as `hello@{host of NEXT_PUBLIC_APP_URL}`, which is right on
  // production by luck and wrong everywhere else — a preview's app URL is
  // a `*.vercel.app` host that is not a verified Resend sending domain, so
  // the derived address could not send at all. It is bound instead.
  //
  // `z.email()` because a malformed From is a mail nobody receives and an
  // error nobody sees until the vendor refuses it, one send at a time; the
  // boot is where that is worth failing. Required with no fallback, like
  // every member that is not a named exception above — `optout.invalid`
  // tells a reader to *reply* to a ReachKit mail, so this must be a real
  // mailbox somebody reads, and a deployment that cannot name one has no
  // business sending.
  //
  // Not server-only: it is printed in the header of every mail we send,
  // which is the opposite of a secret.
  MAIL_FROM: z.email(),
  DATAFORSEO_LOGIN: z.string().min(1),
  DATAFORSEO_PASSWORD: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  NANO_API_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  IP_HASH_SALT: z.string().min(1),
  // "boolean-ish for KILL_SWITCH" (WO-005 step 1).
  KILL_SWITCH: z.stringbool(),
  // "comma-separated list for OWNER_EMAILS" (WO-005 step 1).
  OWNER_EMAILS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((entry) => entry.trim()))
    .pipe(z.array(z.email()).min(1)),
  NEXT_PUBLIC_APP_URL: z.url(),
  HOSTED_EDGE_CNAME_TARGET: z.string().min(1),
  // **The two bindings the customer's own subdomain needs** (issue #322).
  // SPEC §5's ruling of 2026-09-12: on save the app "adds the hostname to
  // the project's domain list through the Vercel Domains API with our
  // server-only token". A hostname that is never added is a customer CNAME
  // answered by the platform's own 404, so these are what stand between a
  // pointed record and a served page.
  //
  // `.optional()` for the reason the two jobs bindings are, and it is a
  // named exception on the same footing: the required set is what *every*
  // process must carry, and the processes that are not deployments — a
  // local `next dev`, a local production build, the layout suite's build
  // and server in CI — add no domain to any project. A deployment that
  // carries neither attaches nothing, and the destination stays "waiting
  // for DNS", which is what it honestly is; nothing here fabricates a live
  // one. `src/lib/vendors/vercel/domains.ts` is the one reader.
  VERCEL_API_TOKEN: z.string().min(1).optional(),
  // The project the customer's hostname is added to. An identifier rather
  // than a secret — it names a project, it does not open one — so it is
  // not in the server-only set below.
  VERCEL_PROJECT_ID: z.string().min(1).optional(),
});

// BP-005 decision 6b: "the member's type is a required `string` either
// way — no caller can observe which key it received, and none is asked to
// choose." `z.infer` alone would make `NANO_API_KEY` `string | undefined`
// (the schema's own `.optional()`); this type is what every reader of `Env`
// actually sees, once `parseEnv()` has resolved the fallback.
type ParsedEnv = z.infer<typeof schema>;
export type Env = Omit<ParsedEnv, "NANO_API_KEY"> & { NANO_API_KEY: string };

// WO-005 file plan: "`SUPABASE_SERVICE_ROLE`, `STRIPE_SECRET_KEY`,
// `RESEND_API_KEY`, `DATAFORSEO_PASSWORD`, `ANTHROPIC_API_KEY`,
// `NANO_API_KEY` and `IP_HASH_SALT` are marked server-only and their access
// throws if the module is evaluated in a client bundle." — the closed set;
// nothing outside it is guarded, and BP-002's `dbAdmin()` (WO-011) carries
// the analogous build-time guard for its own secret. BP-005 decision 6a:
// one name end to end, not an alias — this reader moves with the rename.
//
// Issue #315 adds the two jobs bindings to that set. A signing key is what
// proves a request to `/api/jobs` came from the platform and an event key is
// what lets this process put work on the queue; neither has any business in
// a browser bundle, and they are the same kind of secret as the six above.
const SERVER_ONLY_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "DATAFORSEO_PASSWORD",
  "ANTHROPIC_API_KEY",
  "NANO_API_KEY",
  "IP_HASH_SALT",
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  // Issue #322: a token that can add a domain to our project has no
  // business in a browser bundle. Same kind of secret as the nine above.
  "VERCEL_API_TOKEN",
] as const satisfies readonly (keyof Env)[];

const serverOnlyKeySet: ReadonlySet<string> = new Set(SERVER_ONLY_KEYS);

function isClientBundle(): boolean {
  // The lexical property a bundler-free runtime can observe: `window`
  // exists in a browser (or a browser-like test environment) and never in
  // a Node.js process. This is a runtime guard on *access*, independent of
  // BP-002's build-time guard on `dbAdmin()`'s own import.
  return typeof window !== "undefined";
}

function parseEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `src/lib/config/env.ts: invalid or missing environment binding(s):\n${result.error.message}`
    );
  }
  // BP-005 decision 6b: the resolution happens here, before any caller reads
  // `env` — `ANTHROPIC_API_KEY` is itself a required member this same parse
  // has already validated, never a fabricated or hard-coded literal.
  return {
    ...result.data,
    NANO_API_KEY: result.data.NANO_API_KEY ?? result.data.ANTHROPIC_API_KEY,
  };
}

/** Every name the schema declares, present or not. Iterating the *parsed*
 *  object instead would leave an unset `.optional()` binding without a key
 *  and therefore without its server-only guard — the guard would then hold
 *  on the deployments that set the binding and not on the others, and
 *  `Object.keys(env)` would change shape with the environment. */
const BINDING_KEYS = Object.keys(schema.shape) as (keyof Env)[];

function freezeWithGuards(parsed: Env): Readonly<Env> {
  const target = {} as Env;
  for (const key of BINDING_KEYS) {
    const isServerOnly = serverOnlyKeySet.has(key);
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: false,
      get(): Env[typeof key] {
        if (isServerOnly && isClientBundle()) {
          throw new Error(
            `src/lib/config/env.ts: "${key}" is server-only and cannot be read from a client bundle.`
          );
        }
        return parsed[key];
      },
    });
  }
  return Object.freeze(target);
}

export const env: Readonly<Env> = freezeWithGuards(parseEnv());

/** A real deployment that carries no jobs bindings. Names the bindings that
 *  are missing and never a value — nothing here reads one. */
export class MissingJobsBindings extends Error {
  constructor(readonly missing: readonly string[]) {
    super(
      `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set. ` +
        "This deployment serves /api/jobs, so without them the platform cannot " +
        "verify a delivery and this process cannot put work on the queue: the " +
        "hourly ticks never run and nothing says so. Set them on this environment."
    );
    this.name = "MissingJobsBindings";
  }
}

/**
 * The boot invariant (issue #315). Throws when a real deployment is missing
 * either jobs binding; silent everywhere else.
 *
 * `src/instrumentation.ts` calls it — the one boot path, run once per server
 * instance before that instance answers anything. Local and needing nobody,
 * like the clock check it sits beside: a deployment that could not run a job
 * is a deployment that has quietly stopped publishing, and it fails at boot
 * rather than at the first tick nobody is watching.
 */
export function assertJobsBindings(): void {
  if (!isRealDeployment()) return;
  const missing = (["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"] as const).filter(
    (name) => env[name] === undefined
  );
  if (missing.length > 0) throw new MissingJobsBindings(missing);
}
