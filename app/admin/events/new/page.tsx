import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import EventForm from "@/components/admin/EventForm";
import { createEvent } from "@/lib/actions/events";
import { listWritableAssociations } from "@/lib/permissions";

// Création côté supervision (rôle ADMIN) — les organisateurs créent depuis
// l'espace de leur association (/associations/[id]/events/new).
export default async function NewEventPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const associations = await listWritableAssociations("EVENTS");

  return (
    <div className="max-w-2xl p-8">
      <Link href="/admin/events" className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime">
        ← Événements
      </Link>
      <h1 className="mb-6 mt-3 font-display text-4xl font-bold text-white">Nouvel événement</h1>
      {associations.length === 0 ? (
        <p className="panel p-4 font-nav text-sm text-ink-soft">
          Aucune association pour organiser cet événement —{" "}
          <Link href="/associations/new" className="text-lime hover:underline">
            créez-en une
          </Link>
          .
        </p>
      ) : (
        <EventForm
          action={createEvent}
          submitLabel="Créer l'événement"
          associations={associations.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}
    </div>
  );
}
