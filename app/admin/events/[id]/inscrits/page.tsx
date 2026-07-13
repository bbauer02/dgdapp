import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LegacyInscritsRedirect({
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
  redirect(`/associations/${event.associationId}/events/${id}/inscrits`);
}
