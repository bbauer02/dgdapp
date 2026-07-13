import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

// Supervision plateforme : la liste GLOBALE des événements (rôle ADMIN).
// Les organisateurs gèrent leurs événements dans l'espace de leur association.
export default async function EventsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const events = await prisma.event.findMany({
    orderBy: { startDate: "asc" },
    include: {
      association: { select: { id: true, name: true } },
      _count: { select: { packages: true, registrations: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Supervision</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-white">Événements</h1>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mt-8 font-nav text-ink-soft">Aucun événement pour l'instant.</p>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hair">
              <tr className="[&>th]:px-4 [&>th]:py-3">
                <th className="stat-label">Titre</th>
                <th className="stat-label">Association</th>
                <th className="stat-label">Dates</th>
                <th className="stat-label">Formules</th>
                <th className="stat-label">Inscriptions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-hair [&>td]:px-4 [&>td]:py-3">
                  <td>
                    {e.association ? (
                      <Link
                        href={`/associations/${e.association.id}/events/${e.id}`}
                        className="font-display text-base font-bold uppercase text-white hover:text-lime"
                      >
                        {e.title}
                      </Link>
                    ) : (
                      <span className="font-display text-base font-bold uppercase text-white">
                        {e.title}
                      </span>
                    )}
                  </td>
                  <td className="font-nav text-ink-soft">
                    {e.association ? (
                      <Link
                        href={`/associations/${e.association.id}/dashboard`}
                        className="hover:text-lime"
                      >
                        {e.association.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="font-nav text-ink-soft">
                    {dateFmt.format(e.startDate)} → {dateFmt.format(e.endDate)}
                  </td>
                  <td className="font-display font-bold text-violet-bright">{e._count.packages}</td>
                  <td>
                    {e.association ? (
                      <Link
                        href={`/associations/${e.association.id}/events/${e.id}/inscrits`}
                        className="font-display font-bold text-lime hover:underline"
                      >
                        {e._count.registrations}
                      </Link>
                    ) : (
                      <span className="font-display font-bold text-lime">
                        {e._count.registrations}
                      </span>
                    )}
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
