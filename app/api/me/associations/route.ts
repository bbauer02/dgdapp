import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/permissions";

// Associations (ACTIVE) de l'utilisateur connecté — alimente le switcher
// d'association du SiteHeader, avec le nombre d'éléments "à traiter"
// (adhésions / réclamations en attente) selon les droits du membre.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ associations: [] });

  const memberships = await prisma.associationMember.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: { association: { select: { id: true, name: true } } },
    orderBy: { association: { name: "asc" } },
  });

  const associations = await Promise.all(
    memberships.map(async ({ association }) => {
      const perms = await getEffectivePermissions(session.user.id, association.id);
      const [pendingMemberships, pendingClaims] = await Promise.all([
        perms.MEMBERS === "WRITE"
          ? prisma.associationMember.count({
              where: { associationId: association.id, status: "PENDING" },
            })
          : Promise.resolve(0),
        perms.ACHIEVEMENTS === "WRITE"
          ? prisma.achievementClaim.count({
              where: { status: "PENDING", achievement: { associationId: association.id } },
            })
          : Promise.resolve(0),
      ]);
      return { ...association, pending: pendingMemberships + pendingClaims };
    })
  );

  return NextResponse.json({ associations });
}
