import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

/**
 * Dev-only scaffolding pages (`/design/*` fixture galleries, `/test-*` pipeline
 * previews) render hardcoded/fixture numbers with no auth. They mirror the
 * `blockInProd()` guard already on the `/api/test-*` routes, but PAGES had no
 * gate — so they served fabricated scores publicly in prod. Block them here (one
 * choke point) rather than gating ~20 pages individually. No real route starts
 * with `/design` or `/test-`, so a prefix match is safe.
 */
function isDevOnlyPath(pathname: string): boolean {
  return (
    pathname === "/design" ||
    pathname.startsWith("/design/") ||
    pathname.startsWith("/test-")
  );
}

/**
 * Root middleware: (1) 404 dev-only scaffolding in production, then (2) refresh
 * the Supabase auth session on every page navigation so rotated tokens are
 * persisted (see lib/auth/middleware.ts for the why) — what keeps `/app`
 * navigation from throwing refresh_token_not_found.
 */
export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && isDevOnlyPath(request.nextUrl.pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all page routes so any surface that reads the session (the whole
     * /app workspace + the auth-aware marketing nav) gets a fresh token. Skip:
     *   - _next static/image assets
     *   - /api/* (webhooks like /api/inngest do their own signature auth and
     *     must not have their request/response cookies rewritten)
     *   - common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|woff2?)$).*)",
  ],
};
