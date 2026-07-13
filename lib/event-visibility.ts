import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// RF-12 — event visibility.
//   PUBLIC  : visible by everyone, signed-in or not.
//   MEMBERS : visible only by ACTIVE members of the organising association,
//             by a platform ADMIN, or by an INVITED outsider (EventInvitation
//             PENDING — so they can respond — or ACCEPTED).
// ---------------------------------------------------------------------------

/** Invitation matching: by attached account, or by the session email. */
function invitedWhere(session: Session): Prisma.EventInvitationWhereInput {
  return {
    status: { in: ["PENDING", "ACCEPTED"] },
    OR: [
      { userId: session.user.id },
      ...(session.user.email
        ? [{ email: { equals: session.user.email, mode: "insensitive" as const } }]
        : []),
    ],
  };
}

/** Prisma `where` fragment listing only the events the viewer may see. */
export function visibleEventsWhere(session: Session | null): Prisma.EventWhereInput {
  if (!session) return { visibility: "PUBLIC" };
  if (session.user.role === "ADMIN") return {};
  return {
    OR: [
      { visibility: "PUBLIC" },
      {
        visibility: "MEMBERS",
        association: {
          memberships: {
            some: { userId: session.user.id, status: "ACTIVE" },
          },
        },
      },
      { visibility: "MEMBERS", invitations: { some: invitedWhere(session) } },
    ],
  };
}

/** Point check for a single event (detail page + server actions). */
export async function canViewEvent(
  session: Session | null,
  event: { id?: string; visibility: "PUBLIC" | "MEMBERS"; associationId: string | null }
): Promise<boolean> {
  if (event.visibility === "PUBLIC") return true;
  if (!session) return false;
  if (session.user.role === "ADMIN") return true;

  if (event.associationId) {
    const membership = await prisma.associationMember.findUnique({
      where: {
        userId_associationId: {
          userId: session.user.id,
          associationId: event.associationId,
        },
      },
      select: { status: true },
    });
    if (membership?.status === "ACTIVE") return true;
  }

  // Invited outsiders see the private event (to respond, then to attend).
  if (event.id) {
    const invitation = await prisma.eventInvitation.findFirst({
      where: { eventId: event.id, ...invitedWhere(session) },
      select: { id: true },
    });
    if (invitation) return true;
  }
  return false;
}
