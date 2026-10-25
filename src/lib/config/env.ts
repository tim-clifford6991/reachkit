// src/lib/config/env.ts — every deployment binding, parsed and validated at module load.
//
// A missing or malformed binding throws at boot: there is no default and no
// fallback, so a deployment cannot start half-configured. Imports `zod` and
// `./now` (for `isRealDeployment()`, the one definition of "a deployment
// customers reach"); `./now` imports nothing, so this module still sits at the
// bottom of the graph.
import { z } from "zod";
import { isRealDeployment } from "./now";

// `HOSTED_EDGE_CNAME_TARGET` is the hostname a customer points
// `content.{their-domain}` at: one deployment-scoped hostname, so a binding
// rather than a constant.
//
// `SUPABASE_SERVICE_ROLE_KEY` is the one name for the service role, with no
// alias. `NANO_API_KEY` is optional and resolved to `ANTHROPIC_API_KEY` inside
// `parseEnv()` before `env` is constructed, so its type stays a required
// `string` (see `type Env`). `DATABASE_URL` is not a member: no module under
// `src/` reads it; it is the migration and test tooling's binding.
//
// **The jobs platform's two bindings.** Without them a deployment starts,
// serves every screen, and cannot run a single job — the hourly crons never
// tick and nothing says so. The SDK still reads them from `process.env` for
// itself (`src/jobs/client.ts` passes neither); this schema adds the
// declaration, the validation, and the refusal below.
//
// They are `.optional()` because the required set is what *every* process
// must carry, and the processes that are not deployments — a local `next dev`,
// a local production build, the layout suite's build and server in CI — run no
// jobs and reach no queue. What a real deployment must carry is asserted by
// `assertJobsBindings()` below, which the one boot path calls: on Vercel, a
// missing key does not start the process.
//
// No `.default(...)` anywhere, and every `.optional()` is a named exception
// that says why beside it.
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  // **The mailbox every ReachKit mail comes from.** Bound rather than derived
  // from the app URL, because a preview's app URL is a `*.vercel.app` host
  // that is not a verified sending domain.
  //
  // `z.email()` because a malformed From is a mail nobody receives and an
  // error nobody sees until the vendor refuses it, one send at a time; the
  // boot is where that is worth failing. Required with no fallback —
  // `optout.invalid` tells a reader to *reply* to a ReachKit mail, so this
  // must be a real mailbox somebody reads, and a deployment that cannot name
  // one has no business sending.
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
  // Boolean-ish.
  KILL_SWITCH: z.stringbool(),
  // A comma-separated list.
  OWNER_EMAILS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((entry) => entry.trim()))
    .pipe(z.array(z.email()).min(1)),
  NEXT_PUBLIC_APP_URL: z.url(),
  HOSTED_EDGE_CNAME_TARGET: z.string().min(1),
  // **The two bindings the customer's own subdomain needs** (SPEC §5): on save
  // the app adds the hostname to the project's domain list through the Vercel
  // Domains API with our server-only token. A hostname that is never added is
  // a customer CNAME answered by the platform's own 404, so these are what
  // stand between a pointed record and a served page.
  //
  // `.optional()` for the reason the two jobs bindings are: the processes
  // that are not deployments add no domain to any project. A deployment that
  // carries neither attaches nothing, and the destination stays "waiting for
  // DNS", which is what it honestly is; nothing here fabricates a live one.
  // `src/lib/vendors/vercel/domains.ts` is the one reader.
  VERCEL_API_TOKEN: z.string().min(1).optional(),
  // The project the customer's hostname is added to. An identifier rather
  // than a secret — it names a project, it does not open one — so it is
  // not in the server-only set below.
  VERCEL_PROJECT_ID: z.string().min(1).optional(),
  // The team that owns that project. A token is refused with 403 for a
  // team-owned project unless the call names the team, so every Domains API
  // call carries it as `?teamId=`. An identifier, not a secret.
  VERCEL_TEAM_ID: z.string().min(1).optional(),
  // Product events through PostHog: the project's own ingestion key and the
  // region's address. `.optional()`: a process that is not a deployment
  // records nothing, and a deployment carrying neither captures nothing rather
  // than refusing to boot. An analytics binding is never what stands between
  // a customer and a scan.
  POSTHOG_API_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.url().optional(),
  // One generated `*.vercel.app` host the middleware treats as a customer's
  // hosted host, so the hosted blog can be walked with no domain and no DNS
  // record. A dev/preview testing aid only: `.optional()` because no process
  // needs it, and the middleware ignores it on production and when it names
  // the app's own host.
  HOSTED_TEST_HOST: z.string().min(1).optional(),
  // The key that reads Anthropic's cost report, so the owner's cost page
  // shows what the model was billed beside what was estimated. The key the
  // product calls the model with cannot read it. `.optional()`: without it AI
  // spend is shown as estimated, and nothing else changes.
  ANTHROPIC_ADMIN_KEY: z.string().min(1).optional(),
  // ReachKit verifies every hosted host in Search Console and Bing Webmaster
  // Tools under its own account. The Google binding is the service-account
  // key JSON, or a JSON array of them: Search Console holds 1,000 properties
  // per account, so the array is the pool. The Bing binding is the Webmaster
  // API key. `.optional()`: without them the weekly pass reads neither
  // engine, and the ladder shows only the steps ReachKit can prove from its
  // own rows (`src/lib/vendors/gsc`, `src/lib/vendors/bing-wmt`).
  GOOGLE_SEARCH_CONSOLE_KEYS: z.string().min(1).optional(),
  BING_WEBMASTER_API_KEY: z.string().min(1).optional(),
});

// `z.infer` alone would make `NANO_API_KEY` `string | undefined` (the
// schema's own `.optional()`); this type is what every reader of `Env` sees
// once `parseEnv()` has resolved the fallback, so no caller can observe which
// key it received.
type ParsedEnv = z.infer<typeof schema>;
export type Env = Omit<ParsedEnv, "NANO_API_KEY"> & { NANO_API_KEY: string };

// The closed set of secrets whose access throws if the module is evaluated in
// a client bundle; nothing outside it is guarded. `dbAdmin()` carries the
// analogous build-time guard for its own secret.
const SERVER_ONLY_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "DATAFORSEO_PASSWORD",
  "ANTHROPIC_API_KEY",
  "NANO_API_KEY",
  "IP_HASH_SALT",
  // A signing key proves a request to `/api/jobs` came from the platform and
  // an event key puts work on the queue.
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  // A token that can add a domain to our project.
  "VERCEL_API_TOKEN",
  // An ingestion key writes events.
  "POSTHOG_API_KEY",
  // An admin key reads the organisation's billing.
  "ANTHROPIC_ADMIN_KEY",
  // A service-account key and an API key that act on every verified host.
  "GOOGLE_SEARCH_CONSOLE_KEYS",
  "BING_WEBMASTER_API_KEY",
] as const satisfies readonly (keyof Env)[];

const serverOnlyKeySet: ReadonlySet<string> = new Set(SERVER_ONLY_KEYS);

function isClientBundle(): boolean {
  // The lexical property a bundler-free runtime can observe: `window`
  // exists in a browser (or a browser-like test environment) and never in
  // a Node.js process. A runtime guard on *access*, independent of the
  // build-time guard on `dbAdmin()`'s own import.
  return typeof window !== "undefined";
}

function parseEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `src/lib/config/env.ts: invalid or missing environment binding(s):\n${result.error.message}`
    );
  }
  // Resolved here, before any caller reads `env`: `ANTHROPIC_API_KEY` is a
  // required member this same parse has already validated, never a
  // fabricated or hard-coded literal.
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
 * The boot invariant. Throws when a real deployment is missing either jobs
 * binding; silent everywhere else.
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
