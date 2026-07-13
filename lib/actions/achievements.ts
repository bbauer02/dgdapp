"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ClaimStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/permissions";
import { auth } from "@/auth";

// ---------------------------------------------------------------------------
// Hauts faits (RF-21..26, RG-03/04) — server actions.
//   Every mutation re-checks its guard here: actions are directly invocable,
//   page-level gating alone is not enough.
// ---------------------------------------------------------------------------

export type AchievementActionResult = { ok: true } | { ok: false; error: string };

const ok: AchievementActionResult = { ok: true };
const fail = (error: string): AchievementActionResult => ({ ok: false, error });

function revalidateAchievementPages(associationId: string) {
  revalidatePath(`/associations/${associationId}/hauts-faits`);
  revalidatePath(`/associations/${associationId}/hauts-faits/manage`);
}

// ---------------------------------------------------------------------------
// RF-21 — CRUD des badges (garde ACHIEVEMENTS/WRITE)
// ---------------------------------------------------------------------------

const achievementSchema = z.object({
  name: z.string().trim().min(1, "Le nom du haut fait est requis").max(120, "Nom trop long (120 max)"),
  description: z
    .string()
    .trim()
    .max(2000, "Description trop longue (2000 max)")
    .optional()
    .transform((v) => (v ? v : undefined)),
  iconUrl: z
    .string()
    .trim()
    .max(500, "URL d'icône trop longue")
    .optional()
    .transform((v) => (v ? v : undefined)),
  points: z.coerce
    .number()
    .int("La valeur en renom doit être un entier")
    .min(0, "La valeur en renom ne peut pas être négative")
    .max(100000, "Valeur en renom trop élevée"),
  repeatable: z.boolean(),
});

export type AchievementInput = z.input<typeof achievementSchema>;

export async function createAchievementAction(
  associationId: string,
  input: AchievementInput
): Promise<AchievementActionResult> {
  await requireModule(associationId, "ACHIEVEMENTS", "WRITE");

  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  const d = parsed.data;

  const duplicate = await prisma.achievement.findUnique({
    where: { associationId_name: { associationId, name: d.name } },
  });
  if (duplicate) return fail("Un haut fait porte déjà ce nom dans l'association.");

  await prisma.achievement.create({
    data: {
      associationId,
      name: d.name,
      description: d.description ?? null,
      iconUrl: d.iconUrl ?? null,
      points: d.points,
      repeatable: d.repeatable,
    },
  });

  revalidateAchievementPages(associationId);
  return ok;
}

export async function updateAchievementAction(
  achievementId: string,
  input: AchievementInput
): Promise<AchievementActionResult> {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return fail("Haut fait introuvable.");
  await requireModule(achievement.associationId, "ACHIEVEMENTS", "WRITE");

  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  const d = parsed.data;

  const duplicate = await prisma.achievement.findUnique({
    where: { associationId_name: { associationId: achievement.associationId, name: d.name } },
  });
  if (duplicate && duplicate.id !== achievementId) {
    return fail("Un autre haut fait porte déjà ce nom dans l'association.");
  }

  await prisma.achievement.update({
    where: { id: achievementId },
    data: {
      name: d.name,
      description: d.description ?? null,
      iconUrl: d.iconUrl ?? null,
      points: d.points,
      repeatable: d.repeatable,
    },
  });

  revalidateAchievementPages(achievement.associationId);
  return ok;
}

export async function deleteAchievementAction(
  achievementId: string
): Promise<AchievementActionResult> {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return fail("Haut fait introuvable.");
  await requireModule(achievement.associationId, "ACHIEVEMENTS", "WRITE");

  // Le badge système (participation automatique, RF-17) n'est pas supprimable.
  if (achievement.isAuto) {
    return fail("Ce haut fait automatique est géré par le système et ne peut pas être supprimé.");
  }

  await prisma.achievement.delete({ where: { id: achievementId } });

  revalidateAchievementPages(achievement.associationId);
  return ok;
}

// ---------------------------------------------------------------------------
// RF-22 — attribution manuelle directe (mode MANUAL, journalisée RG-04)
// ---------------------------------------------------------------------------

export async function grantAchievementAction(
  achievementId: string,
  userId: string
): Promise<AchievementActionResult> {
  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return fail("Haut fait introuvable.");
  const session = await requireModule(achievement.associationId, "ACHIEVEMENTS", "WRITE");

  const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!recipient) return fail("Membre introuvable.");

  // RF-26 : un badge non cumulable ne s'obtient qu'une fois.
  if (!achievement.repeatable) {
    const existing = await prisma.achievementAward.findFirst({
      where: { achievementId, userId },
    });
    if (existing) return fail("Ce membre a déjà obtenu ce haut fait (non cumulable).");
  }

  await prisma.achievementAward.create({
    data: { achievementId, userId, mode: "MANUAL", grantedById: session.user.id },
  });

  revalidateAchievementPages(achievement.associationId);
  revalidatePath(`/players/${userId}`);
  return ok;
}

// ---------------------------------------------------------------------------
// RF-24 — réclamation par l'utilisateur connecté (claim PENDING)
// ---------------------------------------------------------------------------

export async function claimAchievementAction(
  achievementId: string
): Promise<AchievementActionResult> {
  const session = await auth();
  if (!session) return fail("Connectez-vous pour réclamer un haut fait.");
  const userId = session.user.id;

  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return fail("Haut fait introuvable.");

  // RF-26 : les badges automatiques sont hors circuit de réclamation.
  if (achievement.isAuto) {
    return fail("Ce haut fait est attribué automatiquement — il ne se réclame pas.");
  }

  // RF-26 : non cumulable + déjà obtenu → refus propre.
  if (!achievement.repeatable) {
    const alreadyOwned = await prisma.achievementAward.findFirst({
      where: { achievementId, userId },
    });
    if (alreadyOwned) return fail("Vous avez déjà obtenu ce haut fait (non cumulable).");
  }

  // Une seule réclamation ouverte à la fois par badge.
  const openClaim = await prisma.achievementClaim.findFirst({
    where: { achievementId, userId, status: "PENDING" },
  });
  if (openClaim) return fail("Une réclamation est déjà en attente pour ce haut fait.");

  await prisma.achievementClaim.create({
    data: { achievementId, userId, status: "PENDING" },
  });

  revalidateAchievementPages(achievement.associationId);
  return ok;
}

// ---------------------------------------------------------------------------
// RF-25 / RG-03 — instruction d'une réclamation (garde ACHIEVEMENTS/WRITE)
//   APPROVED → AchievementAward mode CLAIM. REJECTED → motif OBLIGATOIRE,
//   consigné dans le fil (ClaimMessage fromAdmin).
// ---------------------------------------------------------------------------

export async function reviewClaimAction(
  claimId: string,
  decision: Extract<ClaimStatus, "APPROVED" | "REJECTED">,
  reason?: string
): Promise<AchievementActionResult> {
  const claim = await prisma.achievementClaim.findUnique({
    where: { id: claimId },
    include: { achievement: true },
  });
  if (!claim) return fail("Réclamation introuvable.");
  const session = await requireModule(claim.achievement.associationId, "ACHIEVEMENTS", "WRITE");

  if (claim.status !== "PENDING") return fail("Cette réclamation a déjà été instruite.");

  const message = reason?.trim() ?? "";

  if (decision === "REJECTED") {
    // RG-03 : tout refus est motivé.
    if (!message) return fail("Un motif de refus est obligatoire (RG-03).");
    await prisma.$transaction([
      prisma.achievementClaim.update({ where: { id: claimId }, data: { status: "REJECTED" } }),
      prisma.claimMessage.create({
        data: { claimId, authorId: session.user.id, fromAdmin: true, body: message },
      }),
    ]);
  } else {
    // RF-26 : garde-fou si le badge a été obtenu entre-temps.
    if (!claim.achievement.repeatable) {
      const alreadyOwned = await prisma.achievementAward.findFirst({
        where: { achievementId: claim.achievementId, userId: claim.userId },
      });
      if (alreadyOwned) {
        return fail("Ce membre a déjà obtenu ce haut fait (non cumulable) — refusez la réclamation avec un motif.");
      }
    }
    await prisma.$transaction([
      prisma.achievementClaim.update({ where: { id: claimId }, data: { status: "APPROVED" } }),
      prisma.achievementAward.create({
        data: {
          achievementId: claim.achievementId,
          userId: claim.userId,
          mode: "CLAIM",
          grantedById: session.user.id,
        },
      }),
      ...(message
        ? [
            prisma.claimMessage.create({
              data: { claimId, authorId: session.user.id, fromAdmin: true, body: message },
            }),
          ]
        : []),
    ]);
  }

  revalidateAchievementPages(claim.achievement.associationId);
  revalidatePath(`/players/${claim.userId}`);
  return ok;
}

// ---------------------------------------------------------------------------
// RF-25 — réponse du réclamant : le fil continue et la réclamation repasse
//   PENDING (même mécanique que les dossiers costume).
// ---------------------------------------------------------------------------

const replySchema = z.object({
  body: z.string().trim().min(1, "Votre réponse ne peut pas être vide").max(4000, "Réponse trop longue"),
});

export async function replyToClaimAction(
  claimId: string,
  body: string
): Promise<AchievementActionResult> {
  const session = await auth();
  if (!session) return fail("Connectez-vous pour répondre.");

  const parsed = replySchema.safeParse({ body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Réponse invalide");

  const claim = await prisma.achievementClaim.findUnique({
    where: { id: claimId },
    include: { achievement: { select: { associationId: true } } },
  });
  if (!claim) return fail("Réclamation introuvable.");
  if (claim.userId !== session.user.id) return fail("Seul l'auteur de la réclamation peut répondre.");
  if (claim.status === "APPROVED") return fail("Cette réclamation a été validée — rien à ajouter.");

  await prisma.$transaction([
    prisma.claimMessage.create({
      data: { claimId, authorId: session.user.id, fromAdmin: false, body: parsed.data.body },
    }),
    prisma.achievementClaim.update({ where: { id: claimId }, data: { status: "PENDING" } }),
  ]);

  revalidateAchievementPages(claim.achievement.associationId);
  return ok;
}
