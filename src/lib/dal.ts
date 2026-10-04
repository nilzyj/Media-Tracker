import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Data-access helper used by every server component / action that touches
 * user-owned data. Authorisation is enforced here rather than in layouts so
 * that each route is checked on navigation.
 */
export const requireUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return { id: userId, email: session.user.email ?? "", name: session.user.name ?? "" };
});

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
