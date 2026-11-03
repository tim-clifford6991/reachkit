// src/app/api/scan/[scanId]/reads/route.ts — whether an open report is still
// reading searches in the background (SPEC §2, issue 1440).
//
// The report polls this instead of re-rendering itself, and re-renders once
// when the answer turns false. The body is one boolean the page already
// shows: an unknown, superseded or removed scan answers exactly as a finished
// one, so the route tells a stranger nothing the address would not.
import { adapter } from "../../../_adapter";
import { stillFinishing } from "@/lib/scan/status";

export const dynamic = "force-dynamic";

export const GET = adapter(
  "GET /api/scan/[scanId]/reads",
  async (_request: Request, { params }: { params: Promise<{ scanId: string }> }): Promise<Response> => {
    const { scanId } = await params;
    const finishing = await stillFinishing(scanId, new Date());
    return Response.json({ finishing }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
);
