import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor, initials } from "@/lib/faction";

// Aiguillage post-connexion : un dashboard par association.
//   0 association → accueil (ou poste de commandement pour l'ADMIN plateforme)
//   1 association → son dashboard directement
//   plusieurs     → écran de choix ci-dessous
export default async function DashboardDispatch() {
  const session = await auth();
  if (!session) redirect("/login");

  const memberships = await prisma.associationMember.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: {
      association: {
        select: {
          id: true,
          name: true,
          nameNormalized: true,
          _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        },
      },
      roles: { select: { name: true } },
    },
    orderBy: { association: { name: "asc" } },
  });

  if (memberships.length === 0) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/");
  }
  if (memberships.length === 1) {
    redirect(`/associations/${memberships[0].associationId}/dashboard`);
  }

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    role: session.user.role,
  };

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <section className="relative overflow-hidden bg-hex">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="kicker justify-center">
            <span className="slash" aria-hidden /> Un dashboard par association
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold uppercase text-white md:text-6xl">
            Choisissez votre QG
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-body text-sm text-ink-soft">
            Vous êtes membre de plusieurs associations. Chaque association a son
            propre tableau de bord — vous pourrez en changer à tout moment depuis
            l'en-tête.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {memberships.map((m) => {
            const a = m.association;
            const color = factionColor(a.nameNormalized);
            return (
              <Link
                key={a.id}
                href={`/associations/${a.id}/dashboard`}
                className="panel group relative overflow-hidden p-6 transition hover:border-violet hover:shadow-neon-violet"
              >
                <span
                  className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg]"
                  style={{ background: color }}
                />
                <div className="flex items-center gap-4">
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center font-display text-xl font-bold"
                    style={{ border: `1px solid ${color}`, color }}
                  >
                    {initials(a.name, a.name.split(/\s+/)[1] ?? "")}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-2xl font-bold uppercase leading-tight text-white group-hover:text-lime">
                      {a.name}
                    </h2>
                    <p className="stat-label mt-1">
                      {a._count.memberships} membre{a._count.memberships > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {m.roles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.roles.map((r) => (
                      <span
                        key={r.name}
                        className="badge border-violet/50 bg-violet/10 text-violet-bright"
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-5 inline-block font-nav text-xs font-semibold uppercase tracking-wider text-lime">
                  Entrer dans le dashboard →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
