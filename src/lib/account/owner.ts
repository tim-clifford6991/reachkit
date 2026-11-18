// The owner is an account signed in at one of `OWNER_EMAILS`; an account or site that cannot be read is a customer's.
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";

/** Whether `userId`'s sign-in address is an owner's. */
export async function isOwner(userId: string): Promise<boolean> {
  const { data, error } = await dbAdmin().from("users").select("email").eq("id", userId).limit(1);
  const email = error === null ? data?.[0]?.email?.toLowerCase() : undefined;
  return email !== undefined && env.OWNER_EMAILS.some((owner) => owner.toLowerCase() === email);
}

/** Whether the site's account is an owner's. */
export async function isOwnerSite(siteId: string): Promise<boolean> {
  const { data, error } = await dbAdmin().from("sites").select("user_id").eq("id", siteId).limit(1);
  const userId = error === null ? data?.[0]?.user_id : undefined;
  return userId !== undefined && (await isOwner(userId));
}
