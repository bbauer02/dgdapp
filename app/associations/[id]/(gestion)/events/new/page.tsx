import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/permissions";
import EventForm from "@/components/admin/EventForm";
import { createEvent } from "@/lib/actions/events";

// Création d'un événement pour CETTE association (RF-11) — l'asso
// organisatrice est verrouillée sur celle de l'espace courant.
export default async function NewAssoEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireModule(id, "EVENTS", "WRITE");

  const association = await prisma.association.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!association) notFound();

  return (
    <div className="max-w-2xl p-8">
      <Link
        href={`/associations/${id}/events`}
        className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
      >
        ← Événements
      </Link>
      <h1 className="mb-6 mt-3 font-display text-4xl font-bold text-white">Nouvel événement</h1>
      <EventForm
        action={createEvent}
        submitLabel="Créer l'événement"
        associations={[{ id: association.id, name: association.name }]}
      />
    </div>
  );
}
