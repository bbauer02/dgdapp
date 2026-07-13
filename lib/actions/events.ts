"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEventModule, requireModule } from "@/lib/permissions";

export type FormState = { error?: string } | undefined;

const socialLinksSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(40),
      url: z.string().trim().url("URL de réseau social invalide"),
    })
  )
  .max(10);

const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Titre requis"),
    description: z.string().trim().optional(),
    startDate: z.string().min(1, "Date de début requise"),
    endDate: z.string().min(1, "Date de fin requise"),
    // RF-11: an event is organised by an association.
    associationId: z.string().trim().min(1, "Association organisatrice requise"),
    // RF-12: public by default, restrictable to members.
    visibility: z.enum(["PUBLIC", "MEMBERS"]),
    location: z.string().trim().optional(),
    // Geocoded position of `location` (LocationPicker) — empty when no marker.
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    // RF-14: does registration require a costume dossier?
    requiresCostume: z.boolean(),
    maxParticipants: z.string().optional(),
    basePrice: z.string().optional(),
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
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "La date de fin doit être postérieure au début.",
    path: ["endDate"],
  });

function parseEvent(formData: FormData) {
  // Hidden lat/lng inputs submit "" when no marker — z.coerce would turn "" into 0.
  const coord = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  return eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    associationId: formData.get("associationId"),
    visibility: formData.get("visibility") ?? "PUBLIC",
    location: formData.get("location") ?? undefined,
    latitude: coord("latitude"),
    longitude: coord("longitude"),
    logoUrl: formData.get("logoUrl") ?? undefined,
    bannerUrl: formData.get("bannerUrl") ?? undefined,
    socialLinks: formData.get("socialLinks") ?? "[]",
    requiresCostume: formData.get("requiresCostume") === "on",
    maxParticipants: formData.get("maxParticipants") ?? undefined,
    basePrice: formData.get("basePrice") ?? undefined,
  });
}

function toData(d: z.infer<typeof eventSchema>) {
  const max = d.maxParticipants?.trim();
  const price = d.basePrice?.trim();
  return {
    title: d.title,
    description: d.description || null,
    startDate: new Date(d.startDate),
    endDate: new Date(d.endDate),
    associationId: d.associationId,
    visibility: d.visibility,
    location: d.location || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    logoUrl: d.logoUrl || null,
    bannerUrl: d.bannerUrl || null,
    socialLinks: d.socialLinks,
    requiresCostume: d.requiresCostume,
    maxParticipants: max ? parseInt(max, 10) : null,
    basePrice: price ? price : "0",
  };
}

// La gestion d'un événement vit sous /associations/[id]/events/[eventId] —
// on revalide par motif de route (les deux segments sont dynamiques).
function revalidateEventAdmin() {
  revalidatePath("/associations/[id]/events", "page");
  revalidatePath("/associations/[id]/events/[eventId]", "page");
}

/**
 * RF-17 — le badge automatique « Participation à l'événement » doit exister
 * pour l'association organisatrice : on le crée à la première création
 * d'événement s'il manque (idempotent — un seul badge isAuto par association).
 */
async function ensureParticipationAchievement(associationId: string) {
  const existing = await prisma.achievement.findFirst({
    where: { associationId, isAuto: true },
    select: { id: true },
  });
  if (existing) return;

  // upsert : un badge manuel homonyme (unique associationId+name) devient
  // le badge automatique plutôt que de faire échouer la création d'événement.
  await prisma.achievement.upsert({
    where: {
      associationId_name: { associationId, name: "Participation à l'événement" },
    },
    update: { repeatable: true, isAuto: true },
    create: {
      associationId,
      name: "Participation à l'événement",
      description: "Attribué automatiquement à chaque inscription validée.",
      points: 10,
      repeatable: true,
      isAuto: true,
    },
  });
}

export async function createEvent(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = parseEvent(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  // RF-11/RG-01: WRITE on Événements for the CHOSEN organising association.
  await requireModule(parsed.data.associationId, "EVENTS", "WRITE");
  const event = await prisma.event.create({ data: toData(parsed.data) });
  await ensureParticipationAchievement(parsed.data.associationId);
  revalidateEventAdmin();
  revalidatePath("/events");
  redirect(`/associations/${parsed.data.associationId}/events/${event.id}`);
}

export async function updateEvent(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEventModule(id, "EVENTS", "WRITE");
  const parsed = parseEvent(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  // Re-homing an event to another association also requires rights there.
  await requireModule(parsed.data.associationId, "EVENTS", "WRITE");
  await prisma.event.update({ where: { id }, data: toData(parsed.data) });
  revalidateEventAdmin();
  revalidatePath("/events");
  return { error: undefined };
}

export async function deleteEvent(id: string) {
  await requireEventModule(id, "EVENTS", "WRITE");
  const event = await prisma.event.delete({
    where: { id },
    select: { associationId: true },
  });
  revalidateEventAdmin();
  revalidatePath("/events");
  redirect(event.associationId ? `/associations/${event.associationId}/events` : "/dashboard");
}

// --- Packages (formules) ---

const packageSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Nom requis"),
  price: z.string().trim().min(1, "Prix requis"),
  includedItems: z.string().optional(),
  description: z.string().trim().optional(), // markdown
});

export async function addPackage(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEventModule(eventId, "EVENTS", "WRITE");
  const parsed = packageSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    price: formData.get("price"),
    includedItems: formData.get("includedItems") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const items = (parsed.data.includedItems ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.registrationPackage.create({
    data: {
      eventId: parsed.data.eventId,
      name: parsed.data.name,
      price: parsed.data.price,
      includedItems: items,
      description: parsed.data.description || null,
    },
  });
  revalidateEventAdmin();
  return { error: undefined };
}

export async function deletePackage(id: string, eventId: string) {
  await requireEventModule(eventId, "EVENTS", "WRITE");
  await prisma.registrationPackage.delete({ where: { id } });
  revalidateEventAdmin();
}

// --- Rôles incarnables (statuts sociaux configurables, liés à une formule) ---

const characterRoleSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(1, "Nom du rôle requis").max(60),
  description: z.string().trim().optional(),
  packageId: z.string().trim().optional(), // "" → aucun tarif associé
});

export async function addCharacterRole(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const eventId = String(formData.get("eventId") ?? "");
  await requireEventModule(eventId, "EVENTS", "WRITE");
  const parsed = characterRoleSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    packageId: formData.get("packageId") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Rôle invalide" };
  }
  const d = parsed.data;
  if (d.packageId) {
    const pkg = await prisma.registrationPackage.findUnique({
      where: { id: d.packageId },
      select: { eventId: true },
    });
    if (!pkg || pkg.eventId !== d.eventId) return { error: "Formule introuvable" };
  }
  try {
    await prisma.eventCharacterRole.create({
      data: {
        eventId: d.eventId,
        name: d.name,
        description: d.description || null,
        packageId: d.packageId || null,
      },
    });
  } catch {
    return { error: "Ce rôle existe déjà pour cet événement." };
  }
  revalidateEventAdmin();
  revalidatePath(`/events/${d.eventId}`);
  return { error: undefined };
}

export async function deleteCharacterRole(id: string, eventId: string) {
  await requireEventModule(eventId, "EVENTS", "WRITE");
  await prisma.eventCharacterRole.delete({ where: { id } });
  revalidateEventAdmin();
  revalidatePath(`/events/${eventId}`);
}
