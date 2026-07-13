"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";

// One CampLayout per event (CampLayout.eventId is @unique). Saving replaces the
// whole set of placed tokens for that layout — the client owns the full state,
// so a delete-all + recreate is simpler and race-free than diffing.

export type SaveResult = { ok: true } | { error: string };

const segmentSchema = z.object({ color: z.string() });

const tokenSchema = z.object({
  gearId: z.string().optional(),
  label: z.string(),
  shape: z.enum(["ROUND", "RECTANGULAR"]),
  xM: z.number(),
  yM: z.number(),
  rotation: z.number(),
  diameterM: z.number().optional(),
  widthM: z.number().optional(),
  lengthM: z.number().optional(),
  ropeZoneRadiusM: z.number(),
  showRopeZone: z.boolean(),
  color: z.string(),
  segments: z.array(segmentSchema).optional(),
});

const payloadSchema = z.object({
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  pixelsPerMeter: z.number().int().positive(),
  tokens: z.array(tokenSchema),
});

export type SaveLayoutPayload = z.infer<typeof payloadSchema>;

export async function saveCampLayout(
  eventId: string,
  raw: unknown
): Promise<SaveResult> {
  // RG-01 : Écriture sur le module Cartographie de l'asso organisatrice.
  await requireEventModule(eventId, "CARTOGRAPHY", "WRITE");

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Plan invalide" };
  }
  const d = parsed.data;

  // Guard the campGearId FK: only wire a token to real gear declared for THIS
  // event. Free-form / demo tokens keep campGearId null.
  const gearRows = await prisma.campGear.findMany({
    where: { registration: { eventId } },
    select: { id: true },
  });
  const validGear = new Set(gearRows.map((g) => g.id));

  const layout = await prisma.campLayout.upsert({
    where: { eventId },
    create: {
      eventId,
      widthM: d.widthM,
      heightM: d.heightM,
      pixelsPerMeter: d.pixelsPerMeter,
    },
    update: {
      widthM: d.widthM,
      heightM: d.heightM,
      pixelsPerMeter: d.pixelsPerMeter,
    },
  });

  await prisma.$transaction([
    prisma.campToken.deleteMany({ where: { layoutId: layout.id } }),
    prisma.campToken.createMany({
      data: d.tokens.map((t) => ({
        layoutId: layout.id,
        campGearId: t.gearId && validGear.has(t.gearId) ? t.gearId : null,
        label: t.label || null,
        shape: t.shape,
        xM: t.xM,
        yM: t.yM,
        rotation: Math.round(t.rotation),
        diameterM: t.diameterM ?? null,
        widthM: t.widthM ?? null,
        lengthM: t.lengthM ?? null,
        ropeZoneRadiusM: t.ropeZoneRadiusM,
        showRopeZone: t.showRopeZone,
        color: t.color || null,
        segments: t.segments ?? undefined,
      })),
    }),
  ]);

  revalidatePath("/associations/[id]/events/[eventId]/planner", "page");
  return { ok: true };
}
