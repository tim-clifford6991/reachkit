// Pricing's one control: start checkout with no account asked first, and land on the vendor or on the refused line.
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/account/checkout/session";
import { env } from "@/lib/config/env";
import { takeLimits } from "@/lib/limits";
import { networkKeyOf } from "@/lib/scan/admission";
import { LIMITED_PATH, REFUSED_PATH } from "./state";

export async function startCheckout(): Promise<void> {
  // Outside any `try`: `redirect` throws its own control-flow error, which a catch would swallow.
  if (!(await takeLimits("checkout", { network: networkKeyOf(await headers()) }))) redirect(LIMITED_PATH);
  const result = await createCheckoutSession({ origin: { kind: "pricing" }, returnTo: new URL("/pricing", env.NEXT_PUBLIC_APP_URL).toString() });
  redirect(result.ok ? result.url : REFUSED_PATH);
}
