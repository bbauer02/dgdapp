import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";
import PlannerLoader from "@/components/planner/PlannerLoader";
import EventTabs from "@/components/associations/EventTabs";
import type {
  GearDef,
  LayoutConfig,
  PieSegment,
  PlacedToken,
} from "@/lib/planner/types";

// One saved map per event: load its CampLayout (+ tokens) and the tents its
// registered players declared, then hand them to the client planner.
export default async function EventPlannerPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;
  // RG-01 : Écriture sur le module Cartographie de l'asso organisatrice.
  await requireEventModule(eventId, "CARTOGRAPHY", "WRITE");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, associationId: true },
  });
  if (!event || event.associationId !== id) notFound();

  const [layout, gearRows] = await Promise.all([
    prisma.campLayout.findUnique({
      where: { eventId },
      include: { tokens: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.campGear.findMany({
      where: { registration: { eventId } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const gear: GearDef[] = gearRows.map((g) => ({
    id: g.id,
    label: g.label,
    owner: `${g.user.firstName} ${g.user.lastName}`.trim(),
    tentType: g.tentType,
    shape: g.shape,
    diameterM: g.diameterM != null ? Number(g.diameterM) : undefined,
    widthM: g.widthM != null ? Number(g.widthM) : undefined,
    lengthM: g.lengthM != null ? Number(g.lengthM) : undefined,
    ropeZoneRadiusM: Number(g.ropeZoneRadiusM),
    color: g.color ?? "#7c4dff",
  }));

  const initialLayout: LayoutConfig | undefined = layout
    ? {
        widthM: Number(layout.widthM),
        heightM: Number(layout.heightM),
        pixelsPerMeter: layout.pixelsPerMeter,
      }
    : undefined;

  const initialTokens: PlacedToken[] =
    layout?.tokens.map((t) => ({
      id: t.id,
      gearId: t.campGearId ?? undefined,
      label: t.label ?? "",
      shape: t.shape,
      xM: Number(t.xM),
      yM: Number(t.yM),
      rotation: t.rotation,
      diameterM: t.diameterM != null ? Number(t.diameterM) : undefined,
      widthM: t.widthM != null ? Number(t.widthM) : undefined,
      lengthM: t.lengthM != null ? Number(t.lengthM) : undefined,
      ropeZoneRadiusM: Number(t.ropeZoneRadiusM),
      showRopeZone: t.showRopeZone,
      color: t.color ?? "#7c4dff",
      segments: (t.segments as PieSegment[] | null) ?? undefined,
    })) ?? [];

  return (
    <div className="p-8">
      {/* Le planner n'est plus une impasse : mêmes onglets que les autres facettes. */}
      <Link
        href={`/associations/${id}/events`}
        className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
      >
        ← Événements
      </Link>
      <div className="mt-3">
        <h1 className="mb-4 font-display text-4xl font-bold text-white">{event.title}</h1>
        <EventTabs base={`/associations/${id}/events/${event.id}`} />
      </div>

      <PlannerLoader
        eventId={event.id}
        eventTitle={event.title}
        initialLayout={initialLayout}
        initialTokens={initialTokens}
        gear={gear.length > 0 ? gear : undefined}
      />
    </div>
  );
}
