"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { requireModule } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Costume dossier workflow (RF-14..16, RG-03).
//   Submit  : the registration owner files pictures (URLs) → PENDING.
//   Review  : an admin approves or rejects; a refusal REQUIRES a reason
//             (RG-03) posted as a fromAdmin message in the thread.
//   Reply   : the owner answers a refusal → the dossier re-opens (PENDING).
// ---------------------------------------------------------------------------

export type DossierFormState = { error?: string } | undefined;

/** Same approach as the profile galleries: one image URL per line. */
function toUrlList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function revalidateDossierPaths(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/associations/[id]/events/[eventId]/inscrits", "page");
}

/**
 * RF-14 — the OWNER of a registration submits (or re-submits) their costume
 * dossier. `useActionState` signature: bind the registrationId in the UI.
 */
export async function submitDossierAction(
  registrationId: string,
  _prev: DossierFormState,
  formData: FormData
): Promise<DossierFormState> {
  const session = await auth();
  if (!session) redirect("/login");

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, userId: true, eventId: true, status: true },
  });
  if (!registration) return { error: "Inscription introuvable." };
  if (registration.userId !== session.user.id) {
    return { error: "Cette inscription ne vous appartient pas." };
  }
  if (registration.status === "CANCELLED") {
    return { error: "Inscription annulée — réinscrivez-vous d'abord." };
  }

  const type = formData.get("type");
  if (type !== "CIVIL" && type !== "MILITARY") {
    return { error: "Choisissez un type de costume (civil ou militaire)." };
  }
  const fileUrls = toUrlList(formData.get("fileUrls")?.toString());
  if (fileUrls.length === 0) {
    return { error: "Ajoutez au moins une pièce (image ou PDF)." };
  }

  // One dossier per registration: a re-submission replaces the pieces and
  // re-opens the review (PENDING).
  await prisma.costumeDossier.upsert({
    where: { registrationId },
    create: { registrationId, type, fileUrls },
    update: { type, fileUrls, status: "PENDING" },
  });

  revalidateDossierPaths(registration.eventId);
  return undefined;
}

/**
 * RF-15 / RG-03 — admin review. Guard: module EVENTS/WRITE of the organising
 * association when the event has one, platform ADMIN otherwise. A REJECTED
 * decision requires a reason, stored as a fromAdmin message (RG-03).
 */
export async function reviewDossierAction(
  dossierId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
): Promise<DossierFormState> {
  const dossier = await prisma.costumeDossier.findUnique({
    where: { id: dossierId },
    select: {
      id: true,
      registration: {
        select: { eventId: true, event: { select: { associationId: true } } },
      },
    },
  });
  if (!dossier) return { error: "Dossier introuvable." };

  const associationId = dossier.registration.event.associationId;
  const session = associationId
    ? await requireModule(associationId, "EVENTS", "WRITE")
    : await requireAdmin();

  const trimmedReason = reason?.trim() ?? "";
  if (decision === "REJECTED" && !trimmedReason) {
    return { error: "Le motif du refus est obligatoire (RG-03)." };
  }

  await prisma.$transaction([
    prisma.costumeDossier.update({
      where: { id: dossierId },
      data: { status: decision },
    }),
    ...(decision === "REJECTED"
      ? [
          prisma.dossierMessage.create({
            data: {
              dossierId,
              authorId: session.user.id,
              fromAdmin: true,
              body: trimmedReason,
            },
          }),
        ]
      : []),
  ]);

  revalidateDossierPaths(dossier.registration.eventId);
  return undefined;
}

/**
 * `useActionState` wrapper around `reviewDossierAction` for the admin form
 * (one form, two submit buttons: name="decision" value=APPROVED|REJECTED).
 */
export async function reviewDossierFormAction(
  dossierId: string,
  _prev: DossierFormState,
  formData: FormData
): Promise<DossierFormState> {
  const decision = formData.get("decision");
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return { error: "Décision invalide." };
  }
  return reviewDossierAction(dossierId, decision, formData.get("reason")?.toString());
}

/**
 * RF-16 — the owner replies to a refusal: a fromAdmin:false message is added
 * AND the dossier goes back to PENDING (re-opened for review).
 */
export async function replyToDossierAction(
  dossierId: string,
  _prev: DossierFormState,
  formData: FormData
): Promise<DossierFormState> {
  const session = await auth();
  if (!session) redirect("/login");

  const body = (formData.get("body") ?? "").toString().trim();
  if (!body) return { error: "Votre réponse ne peut pas être vide." };

  const dossier = await prisma.costumeDossier.findUnique({
    where: { id: dossierId },
    select: {
      id: true,
      status: true,
      registration: { select: { userId: true, eventId: true } },
    },
  });
  if (!dossier) return { error: "Dossier introuvable." };
  if (dossier.registration.userId !== session.user.id) {
    return { error: "Ce dossier ne vous appartient pas." };
  }
  if (dossier.status !== "REJECTED") {
    return { error: "Vous ne pouvez répondre qu'à un dossier refusé." };
  }

  await prisma.$transaction([
    prisma.dossierMessage.create({
      data: { dossierId, authorId: session.user.id, fromAdmin: false, body },
    }),
    prisma.costumeDossier.update({
      where: { id: dossierId },
      data: { status: "PENDING" }, // RF-16: a reply re-opens the dossier
    }),
  ]);

  revalidateDossierPaths(dossier.registration.eventId);
  return undefined;
}
