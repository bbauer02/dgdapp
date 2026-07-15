"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import type { FormState } from "@/lib/actions/events";

// Invitations d'extérieurs à un événement (notamment privé/MEMBERS) :
// l'organisateur saisit un nom+prénom OU un email ; l'invité reçoit une
// invitation sur la plateforme (visible sur la page de l'événement) et un
// email, et reste "en attente" tant qu'il n'a pas accepté ou refusé.

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Résout la saisie libre ("prénom nom" ou email) en cible d'invitation.
 * Un email est toujours accepté (compte existant ou non) ; un nom doit
 * correspondre à exactement un utilisateur de la plateforme.
 */
async function resolveInvitee(query: string): Promise<
  | { error: string }
  | {
      email: string;
      firstName: string | null;
      lastName: string | null;
      userId: string | null;
    }
> {
  const q = query.trim();
  if (!q) return { error: "Saisissez un nom ou un email." };

  if (q.includes("@")) {
    const parsed = emailSchema.safeParse(q);
    if (!parsed.success) return { error: "Email invalide." };
    const user = await prisma.user.findFirst({
      where: { email: { equals: parsed.data, mode: "insensitive" } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return {
      email: parsed.data,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      userId: user?.id ?? null,
    };
  }

  // Recherche par nom : "prénom nom" (ou une partie).
  const terms = q.split(/\s+/).filter(Boolean);
  const matches = await prisma.user.findMany({
    where: {
      AND: terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, email: true, firstName: true, lastName: true },
    take: 5,
  });
  if (matches.length === 0) {
    return {
      error: "Aucun utilisateur trouvé avec ce nom — invitez-le par email.",
    };
  }
  if (matches.length > 1) {
    const names = matches.map((m) => `${m.firstName} ${m.lastName}`).join(", ");
    return { error: `Plusieurs utilisateurs correspondent (${names}) — précisez, ou utilisez l'email.` };
  }
  const u = matches[0];
  return { email: u.email.toLowerCase(), firstName: u.firstName, lastName: u.lastName, userId: u.id };
}

export async function inviteToEventAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireEventModule(eventId, "EVENTS", "WRITE");

  const resolved = await resolveInvitee(String(formData.get("query") ?? ""));
  if ("error" in resolved) return { error: resolved.error };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) return { error: "Événement introuvable" };

  try {
    await prisma.eventInvitation.create({
      data: {
        eventId,
        email: resolved.email,
        firstName: resolved.firstName,
        lastName: resolved.lastName,
        userId: resolved.userId,
        invitedById: session.user.id,
      },
    });
  } catch {
    return { error: "Cette personne est déjà invitée à cet événement." };
  }

  // Email best-effort (loggé en console si SMTP absent).
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${base}/events/${eventId}`;
  await sendEmail({
    to: resolved.email,
    subject: `Invitation — ${event.title}`,
    text:
      `Vous êtes invité·e à l'événement « ${event.title} » sur DGDAPP.\n\n` +
      `Consultez l'invitation et répondez ici : ${link}\n\n` +
      (resolved.userId
        ? "Connectez-vous avec votre compte pour accepter ou refuser."
        : "Créez votre compte avec cette adresse email pour accéder à l'invitation."),
  });

  revalidatePath("/associations/[id]/events/[eventId]", "page");
  return { error: undefined };
}

export async function revokeInvitationAction(invitationId: string) {
  const invitation = await prisma.eventInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, eventId: true },
  });
  if (!invitation) return;
  await requireEventModule(invitation.eventId, "EVENTS", "WRITE");
  await prisma.eventInvitation.delete({ where: { id: invitationId } });
  revalidatePath("/associations/[id]/events/[eventId]", "page");
}

/** L'invité accepte ou refuse SA PROPRE invitation (matchée par compte ou email). */
export async function respondToInvitationAction(
  invitationId: string,
  accept: boolean
) {
  const session = await auth();
  if (!session) redirect("/login");

  const invitation = await prisma.eventInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, eventId: true, userId: true, email: true, status: true },
  });
  if (!invitation || invitation.status !== "PENDING") return;

  const isMine =
    invitation.userId === session.user.id ||
    (session.user.email ?? "").toLowerCase() === invitation.email.toLowerCase();
  if (!isMine) return;

  await prisma.eventInvitation.update({
    where: { id: invitationId },
    data: {
      status: accept ? "ACCEPTED" : "DECLINED",
      // Attache le compte à l'invitation si elle avait été créée par email seul.
      userId: invitation.userId ?? session.user.id,
    },
  });
  revalidatePath(`/events/${invitation.eventId}`);
}
