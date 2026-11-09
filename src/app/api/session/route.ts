// src/app/api/session/route.ts
//
// Transport only: the static public header asks here, after paint, whether
// this browser is signed in. The middleware guards `/api`, so a request that
// reaches this handler holds a verified session; any other is redirected.
import { adapter } from "../_adapter";

const ROUTE_ID = "/api/session";

// A shared cache would answer one visitor's session to another.
export const dynamic = "force-dynamic";

export const GET = adapter(ROUTE_ID, async () => new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } }));
