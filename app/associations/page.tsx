import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor } from "@/lib/faction";

export default async function AssociationsPage() {
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;

  const associations = await prisma.association.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker flex items-center gap-3">
              <span className="slash" aria-hidden />
              L'annuaire
            </p>
            <h1 className="mt-3 font-display text-5xl font-bold text-white">Associations</h1>
          </div>
          {session && (
            <Link href="/associations/new" className="btn btn-lime">
              Créer une association
            </Link>
          )}
        </div>

        {associations.length === 0 ? (
          <p className="mt-8 font-nav text-ink-soft">Aucune association enregistrée.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {associations.map((a) => {
              const color = factionColor(a.nameNormalized);
              const count = a._count.memberships;
              return (
                <Link
                  key={a.id}
                  href={`/associations/${a.id}`}
                  className="panel group relative flex flex-col gap-2 overflow-hidden p-5 transition hover:border-violet hover:shadow-neon-violet"
                >
                  <span
                    className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg]"
                    style={{ background: color }}
                  />
                  <div
                    className="font-display text-2xl font-bold uppercase leading-tight"
                    style={{ color }}
                  >
                    {a.name}
                  </div>
                  <div className="stat-label mt-1">
                    {count} membre{count > 1 ? "s" : ""}
                    {a.requiresApproval && " · sur validation"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
