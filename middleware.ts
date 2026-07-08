import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

/**
 * Root middleware: refresh the Supabase auth session on every page navigation so
 * rotated tokens are persisted (see lib/auth/middleware.ts for the why). This is
 * what keeps `/app` navigation from throwing refresh_token_not_found.
 */
export async function middleware(request: NextRequest) {
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
