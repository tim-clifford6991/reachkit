import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { inngest } from "@/lib/inngest/client";

const Body = z.object({ store_url: z.string().min(4) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "store_url required" }, { status: 400 });
  let routed;
  try { routed = classifyUrl(parsed.data.store_url); }
  catch { return NextResponse.json({ error: "invalid url" }, { status: 400 }); }
  const db = serverDb();
  const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
  if (app.error) return NextResponse.json({ error: app.error.message }, { status: 500 });
  const scan = await db.from("scans").insert({ app_id: app.data.id, status: "queued" }).select("id").single();
  if (scan.error) return NextResponse.json({ error: scan.error.message }, { status: 500 });
  await inngest.send({ name: "scan/demo.requested", data: { scanId: scan.data.id } });
  return NextResponse.json({ scan_id: scan.data.id });
}
