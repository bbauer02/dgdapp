"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { unstable_update } from "@/auth";
import { requireSelfOrAdmin } from "@/lib/auth-guards";
import { normalizeAssociationName } from "@/lib/associations";

export type FormState = { error?: string } | undefined;

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  birthDate: z.string().trim().optional(),
  profilePicture: z.string().trim().optional(),
  associationId: z.string().trim().optional(),
  newAssociation: z.string().trim().optional(),
  civilianCostumePics: z.string().optional(),
  militaryCostumePics: z.string().optional(),
});

function parseProfile(formData: FormData) {
  return profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    birthDate: formData.get("birthDate") ?? undefined,
    profilePicture: formData.get("profilePicture") ?? undefined,
    associationId: formData.get("associationId") ?? undefined,
    newAssociation: formData.get("newAssociation") ?? undefined,
    civilianCostumePics: formData.get("civilianCostumePics") ?? undefined,
    militaryCostumePics: formData.get("militaryCostumePics") ?? undefined,
  });
}

function toUrlList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function updateProfile(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireSelfOrAdmin(id);
  const parsed = parseProfile(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;

  // Resolve the association: a typed new name wins (upsert by normalized name),
  // otherwise use the selected id, otherwise detach ("Aucune").
  const newName = d.newAssociation?.trim();
  let association;
  if (newName) {
    const nameNormalized = normalizeAssociationName(newName);
    association = {
      connectOrCreate: {
        where: { nameNormalized },
        create: { name: newName, nameNormalized },
      },
    } as const;
  } else if (d.associationId) {
    association = { connect: { id: d.associationId } } as const;
  } else {
    association = { disconnect: true } as const;
  }

  const birthDate = d.birthDate ? new Date(d.birthDate) : null;

  await prisma.user.update({
    where: { id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate,
      profilePicture: d.profilePicture?.trim() ? d.profilePicture.trim() : null,
      civilianCostumePics: toUrlList(d.civilianCostumePics),
      militaryCostumePics: toUrlList(d.militaryCostumePics),
      association,
      // RF-03: saving the profile form completes onboarding (OAuth accounts
      // arrive with profileComplete=false).
      profileComplete: true,
    },
  });

  // Refresh the editor's OWN session (JWT) so the header name/avatar updates
  // immediately. Skip when an admin edits someone else's profile.
  if (session.user.id === id) {
    await unstable_update({
      user: { name: `${d.firstName} ${d.lastName}`.trim() },
    });
  }

  revalidatePath(`/players/${id}`);
  revalidatePath(`/players/${id}/edit`);
  redirect(`/players/${id}`);
}
