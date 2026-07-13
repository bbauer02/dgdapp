import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/permissions";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

// Les événements de CETTE association — la gestion se fait dans son espace,
// plus dans un back-office global (RG-01 : Écriture sur Événements).
export default async function AssoEventsPage({
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

  const events = await prisma.event.findMany({
    where: { associationId: id },
    orderBy: { startDate: "asc" },
    include: {
      _count: { select: { packages: true, registrations: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker">{association.name}</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-white">Événements</h1>
        </div>
        <Link href={`/associations/${id}/events/new`} className="btn btn-primary">
          + Nouvel événement
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="mt-8 font-nav text-ink-soft">
          Aucun événement pour l'instant — créez le premier.
        </p>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hair">
              <tr className="[&>th]:px-4 [&>th]:py-3">
                <th className="stat-label">Titre</th>
                <th className="stat-label">Dates</th>
                <th className="stat-label">Formules</th>
                <th className="stat-label">Inscriptions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-hair [&>td]:px-4 [&>td]:py-3">
                  <td>
                    <Link
                      href={`/associations/${id}/events/${e.id}`}
                      className="font-display text-base font-bold uppercase text-white hover:text-lime"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="font-nav text-ink-soft">
                    {dateFmt.format(e.startDate)} → {dateFmt.format(e.endDate)}
                  </td>
                  <td className="font-display font-bold text-violet-bright">{e._count.packages}</td>
                  <td>
                    <Link
                      href={`/associations/${id}/events/${e.id}/inscrits`}
                      className="font-display font-bold text-lime hover:underline"
                    >
                      {e._count.registrations}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
