import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor, initials } from "@/lib/faction";
import { playerValue, playerValueSelect } from "@/lib/renown";

export default async function PlayersPage() {
  const session = await auth();
  const user: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;

  const players = await prisma.user.findMany({
    where: { role: "PLAYER" },
    orderBy: { createdAt: "asc" },
    include: {
      association: true,
      ...playerValueSelect,
      _count: { select: { campGear: true, registrations: true } },
    },
  });

  return (
    <main className="min-h-screen">
      <SiteHeader user={user} />

      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="kicker flex items-center gap-3">
          <span className="slash" aria-hidden />
          Le roster
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold text-white">Participants</h1>

        {players.length === 0 ? (
          <p className="mt-8 font-nav text-ink-soft">Aucun participant enrôlé.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => {
              const color = factionColor(p.association?.nameNormalized ?? p.id);
              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="panel group relative flex items-center gap-4 overflow-hidden p-4 transition hover:border-violet hover:shadow-neon-violet"
                >
                  <div
                    className="grid h-16 w-16 shrink-0 place-items-center font-display text-2xl font-bold text-base"
                    style={{ background: color }}
                  >
                    {initials(p.firstName, p.lastName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-display text-xl font-bold uppercase text-white">
                      {p.firstName} {p.lastName}
                    </div>
                    <div
                      className="mt-0.5 truncate font-nav text-xs font-semibold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {p.association?.name ?? "Sans association"}
                    </div>
                    <div className="stat-label mt-2 flex items-center gap-2">
                      <span className="text-lime">
                        ★ {playerValue(p.feats, p.achievementAwards)}
                      </span>
                      <span>· {p._count.campGear} tente(s) · {p._count.registrations} event(s)</span>
                    </div>
                  </div>
                  <span
                    className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg]"
                    style={{ background: color }}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
