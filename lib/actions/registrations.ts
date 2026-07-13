"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RegistrationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { requireModule } from "@/lib/permissions";
import { canViewEvent } from "@/lib/event-visibility";

export async function setRegistrationStatus(
  registrationId: string,
  eventId: string,
  status: RegistrationStatus
) {
  // Same reviewer guard as the inscrits page / dossier review: EVENTS/WRITE
  // on the organising association when the event has one (platform ADMINs
  // pass through requireModule), platform ADMIN otherwise.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { associationId: true },
  });
  if (event?.associationId) {
    await requireModule(event.associationId, "EVENTS", "WRITE");
  } else {
    await requireAdmin();
  }
  const reg = await prisma.registration.update({
    where: { id: registrationId },
    data: { status },
  });
  // RF-17: an approved registration earns the association's automatic
  // "Participation à l'événement" badge, when it exists.
  if (status === "APPROVED") {
    await grantParticipationAward(reg.userId, eventId);
  }
  revalidatePath("/associations/[id]/events/[eventId]/inscrits", "page");
}

/**
 * RF-17 / RG-04 — direct, journaled grant of the association's automatic
 * participation badge. No claim circuit, no notification. Idempotent per
 * (user, event); respects `repeatable` across events (RF-26).
 */
export async function grantParticipationAward(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { associationId: true },
  });
  if (!event?.associationId) return;

  const badge = await prisma.achievement.findFirst({
    where: { associationId: event.associationId, isAuto: true },
  });
  if (!badge) return; // RF-17: only "s'il existe pour l'association"

  const existing = await prisma.achievementAward.findFirst({
    where: badge.repeatable
      ? { achievementId: badge.id, userId, eventId } // once per event
      : { achievementId: badge.id, userId }, // once ever
  });
  if (existing) return;

  await prisma.achievementAward.create({
    data: { achievementId: badge.id, userId, mode: "AUTOMATIC", eventId },
  });
}

// ---------------------------------------------------------------------------
// RF-13 — self-service registration.
// ---------------------------------------------------------------------------

/**
 * A signed-in user registers themselves to an event → Registration PENDING.
 * Unique per (userId, eventId): a duplicate is a no-op, a CANCELLED
 * registration is re-opened as PENDING. Enforces RF-12 visibility server-side
 * (actions are directly invocable — page gating is not enough).
 */
export async function registerToEventAction(eventId: string, formData?: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, visibility: true, associationId: true },
  });
  if (!event) return;
  if (!(await canViewEvent(session, event))) return;

  // Optional character role (statut social incarné) picked at sign-up.
  const rawRole = formData?.get("characterRoleId");
  let characterRoleId: string | null = null;
  if (typeof rawRole === "string" && rawRole) {
    const role = await prisma.eventCharacterRole.findUnique({
      where: { id: rawRole },
      select: { eventId: true },
    });
    if (role?.eventId === eventId) characterRoleId = rawRole;
  }

  const existing = await prisma.registration.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  });

  if (existing) {
    // Already registered: only a cancelled registration can be re-opened.
    if (existing.status === "CANCELLED") {
      await prisma.registration.update({
        where: { id: existing.id },
        data: { status: "PENDING", characterRoleId },
      });
    }
  } else {
    try {
      await prisma.registration.create({
        data: { userId: session.user.id, eventId, characterRoleId },
      });
    } catch (e) {
      // P2002 = unique(userId, eventId) race — the user is already registered.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        throw e;
      }
    }
  }

  revalidatePath(`/events/${eventId}`);
}

/** A user cancels their OWN registration (status → CANCELLED). */
export async function cancelMyRegistrationAction(eventId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  await prisma.registration.updateMany({
    where: {
      userId: session.user.id,
      eventId,
      status: { not: "CANCELLED" },
    },
    data: { status: "CANCELLED" },
  });

  revalidatePath(`/events/${eventId}`);
}
