import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { SITE } from "@/lib/seo";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "missing scan id" }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "valid email required" }, { status: 400 });
  }
  const { email } = parsed.data;

  // Send the OTP magic link — uses anon key so the email lands in the
  // Supabase local mailbox (Inbucket) in dev and routes via Resend SMTP in prod.
  const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { error: otpError } = await anonClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE.url}/auth/callback?next=/scan/${id}/results`,
    },
  });
  if (otpError) {
    return NextResponse.json({ message: "could not send magic link" }, { status: 500 });
  }

  // Record the pending claim on the scan row so we can link it post-confirm (Cycle 3).
  const { error: updateError } = await serverDb()
    .from("scans")
    .update({ claim_email: email })
    .eq("id", id);
  if (updateError) {
    // Non-fatal for the user — magic link was already sent; log and continue.
    console.error("claim: failed to record claim_email", updateError.message);
  }

  return NextResponse.json({ ok: true });
}
