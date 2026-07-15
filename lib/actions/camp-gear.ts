"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSelfOrAdmin } from "@/lib/auth-guards";
import {
  DEFAULT_TENT_COLOR,
  TENT_TYPES,
  tentFootprintM2,
  type TentShapeValue,
  type TentTypeValue,
} from "@/lib/camp-gear";

export type GearFormState = { error?: string } | undefined;

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  const s = (v ?? "").toString().trim().replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Declare a tent / piece of camp gear for a user (self or admin).
export async function addCampGear(
  userId: string,
  _prev: GearFormState,
  formData: FormData
): Promise<GearFormState> {
  await requireSelfOrAdmin(userId);

  const label = (formData.get("label") ?? "").toString().trim();
  if (!label) return { error: "Le nom de la tente est requis." };

  const rawType = (formData.get("tentType") ?? "SOLDAT").toString();
  const tentType = (TENT_TYPES.some((t) => t.value === rawType)
    ? rawType
    : "SOLDAT") as TentTypeValue;

  const shape: TentShapeValue =
    formData.get("shape") === "RECTANGULAR" ? "RECTANGULAR" : "ROUND";

  const diameterM = numOrUndef(formData.get("diameterM"));
  const widthM = numOrUndef(formData.get("widthM"));
  const lengthM = numOrUndef(formData.get("lengthM"));
  const ropeZoneRadiusM = numOrUndef(formData.get("ropeZoneRadiusM")) ?? 0;
  const color = (formData.get("color") ?? "").toString().trim() || DEFAULT_TENT_COLOR;

  // Segments = JSON array of hex colours for the round-tent pie livery.
  let segments: string[] = [];
  try {
    const raw = JSON.parse((formData.get("segments") ?? "[]").toString());
    if (Array.isArray(raw)) {
      segments = raw
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c))
        .slice(0, 12);
    }
  } catch {
    segments = [];
  }

  if (shape === "ROUND" && !diameterM) {
    return { error: "Indiquez le diamètre (en mètres) pour une tente ronde." };
  }
  if (shape === "RECTANGULAR" && (!widthM || !lengthM)) {
    return { error: "Indiquez la largeur et la longueur (en mètres)." };
  }

  const footprintAreaM2 = tentFootprintM2(shape, diameterM, widthM, lengthM);

  await prisma.campGear.create({
    data: {
      userId,
      label,
      tentType,
      shape,
      diameterM: shape === "ROUND" ? diameterM : null,
      widthM: shape === "RECTANGULAR" ? widthM : null,
      lengthM: shape === "RECTANGULAR" ? lengthM : null,
      footprintAreaM2: footprintAreaM2 ?? undefined,
      ropeZoneRadiusM,
      color,
      segments: shape === "ROUND" ? segments : [],
    },
  });

  revalidatePath(`/players/${userId}`);
  revalidatePath(`/players/${userId}/edit`);
  redirect(`/players/${userId}/edit`);
}

// Remove a piece of camp gear (owner or admin only).
export async function deleteCampGear(gearId: string) {
  const gear = await prisma.campGear.findUnique({
    where: { id: gearId },
    select: { userId: true },
  });
  if (!gear) return;
  await requireSelfOrAdmin(gear.userId);

  await prisma.campGear.delete({ where: { id: gearId } });

  revalidatePath(`/players/${gear.userId}`);
  revalidatePath(`/players/${gear.userId}/edit`);
}
