// Issue 1478 — who may open `/app/costs`: an account signed in at one of
// `OWNER_EMAILS`, the addresses the product already tells about a failed
// job or a spend ceiling. Every other account is answered the screen's 404,
// so the page is not there for a customer to find.
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";

/** Whether `userId`'s sign-in address is an owner's. An account that
 *  cannot be read is not an owner's. */
export async function isOwner(userId: string): Promise<boolean> {
  const { data, error } = await dbAdmin().from("users").select("email").eq("id", userId).limit(1);
  const email = error === null ? data?.[0]?.email : undefined;
  if (email === undefined) return false;
  const owners = env.OWNER_EMAILS.map((owner) => owner.toLowerCase());
  return owners.includes(email.toLowerCase());
}
