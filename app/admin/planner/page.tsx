import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listWritableAssociations } from "@/lib/permissions";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

// Plans are per-event (one CampLayout per event). This is the entry point:
// pick an event to open (or resume) its saved camp map.
export default async function PlannerIndexPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // Supervision plateforme : les organisateurs ouvrent le plan de camp
  // depuis l'onglet de l'événement, dans l'espace de leur association.
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  // RG-01 : Écriture sur Cartographie de l'asso organisatrice.
  const writable = await listWritableAssociations("CARTOGRAPHY");
  const events = await prisma.event.findMany({
    where:
      session.user.role === "ADMIN"
        ? {}
        : { associationId: { in: writable.map((a) => a.id) } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      campLayout: { select: { updatedAt: true, _count: { select: { tokens: true } } } },
    },
  });

  return (
    <div className="p-8">
      <p className="kicker">Plans de camp</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-white">
        Choisir un événement
      </h1>
      <p className="mt-2 max-w-xl font-nav text-sm text-ink-soft">
        Chaque événement possède son propre plan de camp. Sélectionnez-en un pour
        ouvrir ou reprendre sa carte.
      </p>

      {events.length === 0 ? (
        <p className="mt-8 font-nav text-ink-soft">
          Aucun événement — créez-en un d'abord.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const saved = e.campLayout;
            return (
              <Link
                key={e.id}
                href={`/admin/events/${e.id}/planner`}
                className="panel group relative overflow-hidden p-4 transition hover:border-violet hover:shadow-neon-violet"
              >
                <span className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg] bg-violet" />
                <div className="font-display text-xl font-bold uppercase text-white">
                  {e.title}
                </div>
                <div className="mt-1 font-nav text-xs uppercase tracking-wider text-ink-soft">
                  {dateFmt.format(e.startDate)} → {dateFmt.format(e.endDate)}
                </div>
                <div className="mt-3">
                  {saved ? (
                    <span className="badge badge-ok">
                      Plan · {saved._count.tokens} élément(s)
                    </span>
                  ) : (
                    <span className="badge border-hair text-ink-faint">
                      Aucun plan
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
