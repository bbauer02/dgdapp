import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Use at the top of admin pages AND admin server actions (actions are
 *  directly invocable, so page-level gating is not enough). */
export async function requireAdmin() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}

/** Use at the top of self-service pages AND their server actions (actions are
 *  directly invocable, so page-level gating is not enough). Allows the owner
 *  of `userId` or any ADMIN through. */
export async function requireSelfOrAdmin(userId: string) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.id !== userId && session.user.role !== "ADMIN") {
    redirect(`/players/${userId}`);
  }
  return session;
}
