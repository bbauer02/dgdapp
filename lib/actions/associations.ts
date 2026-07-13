"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppModule, PermissionLevel } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAssociationName } from "@/lib/associations";
import {
  APP_MODULES,
  assertNotLastAdmin,
  createDefaultRoles,
  requireModule,
} from "@/lib/permissions";

export type AssoFormState = { error?: string; success?: string } | undefined;

/** Result of the actions invoked imperatively from client components. */
export type AssoActionResult = { error?: string; success?: string };

function revalidateAssociation(id: string) {
  revalidatePath("/associations");
  revalidatePath(`/associations/${id}`);
  revalidatePath(`/associations/${id}/manage`);
}

// ---------------------------------------------------------------------------
// Création (RF-05/06) — tout utilisateur connecté peut fonder une association.
// Le créateur devient membre ACTIVE avec le rôle par défaut "Président".
// ---------------------------------------------------------------------------

const associationSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court (2 caractères minimum)"),
  description: z.string().trim().optional(),
});

// Identity media + social links, editable from the settings form only.
const socialLinksSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(40),
      url: z.string().trim().url("URL de réseau social invalide"),
    })
  )
  .max(10);

const associationSettingsSchema = associationSchema.extend({
  // Uploaded media URLs (ImageUploadField) — empty string means "none".
  logoUrl: z.string().trim().optional(),
  bannerUrl: z.string().trim().optional(),
  // JSON array of { label, url } from SocialLinksField.
  socialLinks: z
    .string()
    .default("[]")
    .transform((s, ctx) => {
      try {
        const parsed = socialLinksSchema.safeParse(JSON.parse(s));
        if (!parsed.success) {
          ctx.addIssue({
            code: "custom",
            message: parsed.error.issues[0]?.message ?? "Liens sociaux invalides",
          });
          return z.NEVER;
        }
        return parsed.data;
      } catch {
        ctx.addIssue({ code: "custom", message: "Liens sociaux invalides" });
        return z.NEVER;
      }
    }),
});

export async function createAssociationAction(
  _prev: AssoFormState,
  formData: FormData
): Promise<AssoFormState> {
  const session = await auth();
  if (!session) redirect("/login");

  const parsed = associationSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const nameNormalized = normalizeAssociationName(parsed.data.name);
  const existing = await prisma.association.findUnique({ where: { nameNormalized } });
  if (existing) {
    return { error: "Une association portant ce nom existe déjà." };
  }

  const association = await prisma.association.create({
    data: {
      name: parsed.data.name,
      nameNormalized,
      description: parsed.data.description || null,
      createdById: session.user.id,
    },
  });

  // Jeu de rôles par défaut (RF-06), puis enrôlement du fondateur en Président.
  const roles = await createDefaultRoles(association.id);
  const president = roles.find((r) => r.name === "Président");
  await prisma.associationMember.create({
    data: {
      userId: session.user.id,
      associationId: association.id,
      status: "ACTIVE",
      roles: president ? { connect: { id: president.id } } : undefined,
    },
  });

  // Association principale dénormalisée du profil, si pas déjà définie.
  await prisma.user.updateMany({
    where: { id: session.user.id, associationId: null },
    data: { associationId: association.id },
  });

  revalidateAssociation(association.id);
  redirect(`/associations/${association.id}`);
}

// ---------------------------------------------------------------------------
// Adhésion (RF-10) — libre par défaut, sur validation si requiresApproval.
// ---------------------------------------------------------------------------

export async function joinAssociationAction(
  associationId: string,
  _prev: AssoFormState,
  _formData: FormData
): Promise<AssoFormState> {
  const session = await auth();
  if (!session) redirect("/login");

  const association = await prisma.association.findUnique({ where: { id: associationId } });
  if (!association) return { error: "Association introuvable." };

  const existing = await prisma.associationMember.findUnique({
    where: { userId_associationId: { userId: session.user.id, associationId } },
  });
  if (existing) {
    return {
      error:
        existing.status === "PENDING"
          ? "Votre demande d'adhésion est déjà en attente."
          : "Vous êtes déjà membre de cette association.",
    };
  }

  const status = association.requiresApproval ? "PENDING" : "ACTIVE";

  // Adhésion directe → rôle par défaut "Membre" (le nom seul ne donne rien, RF-08).
  const memberRole =
    status === "ACTIVE"
      ? await prisma.assoRole.findUnique({
          where: { associationId_name: { associationId, name: "Membre" } },
        })
      : null;

  await prisma.associationMember.create({
    data: {
      userId: session.user.id,
      associationId,
      status,
      roles: memberRole ? { connect: { id: memberRole.id } } : undefined,
    },
  });

  if (status === "ACTIVE") {
    await prisma.user.updateMany({
      where: { id: session.user.id, associationId: null },
      data: { associationId },
    });
  }

  revalidateAssociation(associationId);
  return {
    success:
      status === "ACTIVE"
        ? "Vous avez rejoint l'association."
        : "Demande d'adhésion envoyée — en attente de validation.",
  };
}

// ---------------------------------------------------------------------------
// Départ — bloqué pour le dernier administrateur (RG-02).
// ---------------------------------------------------------------------------

export async function leaveAssociationAction(
  associationId: string,
  _prev: AssoFormState,
  _formData: FormData
): Promise<AssoFormState> {
  const session = await auth();
  if (!session) redirect("/login");

  const membership = await prisma.associationMember.findUnique({
    where: { userId_associationId: { userId: session.user.id, associationId } },
  });
  if (!membership) return { error: "Vous n'êtes pas membre de cette association." };

  if (membership.status === "ACTIVE") {
    try {
      await assertNotLastAdmin(session.user.id, associationId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Départ impossible (RG-02)." };
    }
  }

  await prisma.associationMember.delete({ where: { id: membership.id } });

  // Si c'était l'association principale du profil, on la détache.
  await prisma.user.updateMany({
    where: { id: session.user.id, associationId },
    data: { associationId: null },
  });

  revalidateAssociation(associationId);
  return { success: "Vous avez quitté l'association." };
}

// ---------------------------------------------------------------------------
// Validation des adhésions PENDING (RF-10) — garde MEMBERS/WRITE.
// ---------------------------------------------------------------------------

export async function approveMembershipAction(membershipId: string): Promise<void> {
  const membership = await prisma.associationMember.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.status !== "PENDING") return;
  await requireModule(membership.associationId, "MEMBERS", "WRITE");

  const memberRole = await prisma.assoRole.findUnique({
    where: {
      associationId_name: { associationId: membership.associationId, name: "Membre" },
    },
  });

  await prisma.associationMember.update({
    where: { id: membershipId },
    data: {
      status: "ACTIVE",
      roles: memberRole ? { connect: { id: memberRole.id } } : undefined,
    },
  });

  await prisma.user.updateMany({
    where: { id: membership.userId, associationId: null },
    data: { associationId: membership.associationId },
  });

  revalidateAssociation(membership.associationId);
}

export async function rejectMembershipAction(membershipId: string): Promise<void> {
  const membership = await prisma.associationMember.findUnique({
    where: { id: membershipId },
  });
  if (!membership || membership.status !== "PENDING") return;
  await requireModule(membership.associationId, "MEMBERS", "WRITE");

  await prisma.associationMember.delete({ where: { id: membershipId } });
  revalidateAssociation(membership.associationId);
}

// ---------------------------------------------------------------------------
// Attribution des rôles d'un membre (RF-09 : cumul autorisé) — MEMBERS/WRITE.
// ---------------------------------------------------------------------------

export async function setMemberRolesAction(
  memberId: string,
  roleIds: string[]
): Promise<AssoActionResult> {
  const membership = await prisma.associationMember.findUnique({
    where: { id: memberId },
    include: { roles: { include: { permissions: true } } },
  });
  if (!membership) return { error: "Membre introuvable." };
  await requireModule(membership.associationId, "MEMBERS", "WRITE");

  // Les rôles assignés doivent appartenir à CETTE association.
  const roles = await prisma.assoRole.findMany({
    where: { id: { in: roleIds }, associationId: membership.associationId },
    include: { permissions: true },
  });
  if (roles.length !== roleIds.length) {
    return { error: "Un des rôles n'appartient pas à cette association." };
  }

  const hadAdmin = membership.roles.some((r) =>
    r.permissions.some((p) => p.module === "MEMBERS" && p.level === "WRITE")
  );
  const keepsAdmin = roles.some((r) =>
    r.permissions.some((p) => p.module === "MEMBERS" && p.level === "WRITE")
  );

  // RG-02 : on ne retire pas ses droits d'admin au dernier admin.
  if (hadAdmin && !keepsAdmin) {
    try {
      await assertNotLastAdmin(membership.userId, membership.associationId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Modification impossible (RG-02)." };
    }
  }

  await prisma.associationMember.update({
    where: { id: memberId },
    data: { roles: { set: roleIds.map((id) => ({ id })) } },
  });

  revalidateAssociation(membership.associationId);
  return { success: "Rôles mis à jour." };
}

// ---------------------------------------------------------------------------
// CRUD des rôles + droits par module (RF-07/08) — garde MEMBERS/WRITE.
// ---------------------------------------------------------------------------

export type RolePermissionInput = { module: AppModule; level: PermissionLevel | null };

const roleNameSchema = z.string().trim().min(1, "Nom du rôle requis").max(60, "Nom trop long");

function sanitizePermissions(
  permissions: RolePermissionInput[]
): Array<{ module: AppModule; level: PermissionLevel }> {
  const out: Array<{ module: AppModule; level: PermissionLevel }> = [];
  for (const p of permissions) {
    if (!p.level) continue; // "—" = aucun droit sur le module
    if (!APP_MODULES.includes(p.module)) continue;
    if (p.level !== "READ" && p.level !== "WRITE") continue;
    if (out.some((o) => o.module === p.module)) continue; // un droit par module
    out.push({ module: p.module, level: p.level });
  }
  return out;
}

export async function createRoleAction(
  associationId: string,
  name: string,
  permissions: RolePermissionInput[]
): Promise<AssoActionResult> {
  await requireModule(associationId, "MEMBERS", "WRITE");

  const parsedName = roleNameSchema.safeParse(name);
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Nom invalide" };
  }

  const duplicate = await prisma.assoRole.findUnique({
    where: { associationId_name: { associationId, name: parsedName.data } },
  });
  if (duplicate) return { error: "Un rôle porte déjà ce nom dans l'association." };

  await prisma.assoRole.create({
    data: {
      associationId,
      name: parsedName.data,
      isDefault: false,
      permissions: { create: sanitizePermissions(permissions) },
    },
  });

  revalidateAssociation(associationId);
  return { success: "Rôle créé." };
}

export async function updateRoleAction(
  roleId: string,
  name: string,
  permissions: RolePermissionInput[]
): Promise<AssoActionResult> {
  const role = await prisma.assoRole.findUnique({
    where: { id: roleId },
    include: { permissions: true },
  });
  if (!role) return { error: "Rôle introuvable." };
  await requireModule(role.associationId, "MEMBERS", "WRITE");

  const parsedName = roleNameSchema.safeParse(name);
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Nom invalide" };
  }

  if (parsedName.data !== role.name) {
    const duplicate = await prisma.assoRole.findUnique({
      where: {
        associationId_name: { associationId: role.associationId, name: parsedName.data },
      },
    });
    if (duplicate) return { error: "Un rôle porte déjà ce nom dans l'association." };
  }

  const next = sanitizePermissions(permissions);

  // RG-02 : si la mise à jour retire MEMBRES/Écriture à ce rôle, il doit
  // rester au moins un admin via un AUTRE rôle.
  const hadAdminGrant = role.permissions.some(
    (p) => p.module === "MEMBERS" && p.level === "WRITE"
  );
  const keepsAdminGrant = next.some((p) => p.module === "MEMBERS" && p.level === "WRITE");
  if (hadAdminGrant && !keepsAdminGrant) {
    const remainingAdmins = await prisma.associationMember.count({
      where: {
        associationId: role.associationId,
        status: "ACTIVE",
        roles: {
          some: {
            id: { not: roleId },
            permissions: { some: { module: "MEMBERS", level: "WRITE" } },
          },
        },
      },
    });
    if (remainingAdmins === 0) {
      return {
        error:
          "Impossible : retirer ce droit laisserait l'association sans administrateur (RG-02).",
      };
    }
  }

  await prisma.assoRole.update({
    where: { id: roleId },
    data: {
      name: parsedName.data,
      permissions: { deleteMany: {}, create: next },
    },
  });

  revalidateAssociation(role.associationId);
  return { success: "Rôle mis à jour." };
}

export async function deleteRoleAction(roleId: string): Promise<AssoActionResult> {
  const role = await prisma.assoRole.findUnique({
    where: { id: roleId },
    include: { permissions: true },
  });
  if (!role) return { error: "Rôle introuvable." };
  await requireModule(role.associationId, "MEMBERS", "WRITE");

  // RF-07 : les rôles par défaut sont modifiables mais pas supprimables.
  if (role.isDefault) return { error: "Les rôles par défaut ne peuvent pas être supprimés." };

  // RG-02 : la suppression ne doit pas laisser l'association sans admin.
  const grantsAdmin = role.permissions.some(
    (p) => p.module === "MEMBERS" && p.level === "WRITE"
  );
  if (grantsAdmin) {
    const remainingAdmins = await prisma.associationMember.count({
      where: {
        associationId: role.associationId,
        status: "ACTIVE",
        roles: {
          some: {
            id: { not: roleId },
            permissions: { some: { module: "MEMBERS", level: "WRITE" } },
          },
        },
      },
    });
    if (remainingAdmins === 0) {
      return {
        error:
          "Impossible : supprimer ce rôle laisserait l'association sans administrateur (RG-02).",
      };
    }
  }

  await prisma.assoRole.delete({ where: { id: roleId } });
  revalidateAssociation(role.associationId);
  return { success: "Rôle supprimé." };
}

// ---------------------------------------------------------------------------
// Paramètres de l'association — garde MEMBERS/WRITE.
// ---------------------------------------------------------------------------

export async function updateAssociationAction(
  associationId: string,
  _prev: AssoFormState,
  formData: FormData
): Promise<AssoFormState> {
  await requireModule(associationId, "MEMBERS", "WRITE");

  const parsed = associationSettingsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    logoUrl: formData.get("logoUrl") ?? undefined,
    bannerUrl: formData.get("bannerUrl") ?? undefined,
    socialLinks: formData.get("socialLinks") ?? "[]",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const requiresApproval = formData.get("requiresApproval") === "on";

  const nameNormalized = normalizeAssociationName(parsed.data.name);
  const duplicate = await prisma.association.findUnique({ where: { nameNormalized } });
  if (duplicate && duplicate.id !== associationId) {
    return { error: "Une association portant ce nom existe déjà." };
  }

  await prisma.association.update({
    where: { id: associationId },
    data: {
      name: parsed.data.name,
      nameNormalized,
      description: parsed.data.description || null,
      requiresApproval,
      logoUrl: parsed.data.logoUrl || null,
      bannerUrl: parsed.data.bannerUrl || null,
      socialLinks: parsed.data.socialLinks,
    },
  });

  revalidateAssociation(associationId);
  return { success: "Paramètres enregistrés." };
}
