import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// La gestion des événements vit désormais dans l'espace de l'association
// organisatrice — cette route ne sert plus qu'à rediriger les anciens liens.
export default async function LegacyEventAdminRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { associationId: true },
  });
  if (!event?.associationId) notFound();
  redirect(`/associations/${event.associationId}/events/${id}`);
}
