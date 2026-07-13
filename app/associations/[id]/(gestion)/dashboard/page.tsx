import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getEffectivePermissions,
  type EffectivePermissions,
} from "@/lib/permissions";
import { factionColor } from "@/lib/faction";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Le tableau de bord d'UNE association : stats et outils scopés à elle,
// selon les droits du membre (RG-01). Un dashboard par asso — on change
// d'association via le switcher de l'en-tête ou /dashboard.
export default async function AssociationDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const isPlatformAdmin = session.user.role === "ADMIN";

  const membership = await prisma.associationMember.findUnique({
    where: { userId_associationId: { userId: session.user.id, associationId: id } },
    include: { roles: { select: { name: true } } },
  });
  const isMember = membership?.status === "ACTIVE";
  // Réservé aux membres actifs (l'ADMIN plateforme passe) — sinon fiche publique.
  if (!isMember && !isPlatformAdmin) redirect(`/associations/${id}`);

  const association = await prisma.association.findUnique({
    where: { id },
    select: { id: true, name: true, nameNormalized: true, requiresApproval: true },
  });
  if (!association) notFound();

  const perms: EffectivePermissions = isPlatformAdmin
    ? { EVENTS: "WRITE", FINANCES: "WRITE", MEMBERS: "WRITE", CARTOGRAPHY: "WRITE", ACHIEVEMENTS: "WRITE" }
    : await getEffectivePermissions(session.user.id, id);
  const canMembers = perms.MEMBERS === "WRITE";
  const canAchievements = perms.ACHIEVEMENTS === "WRITE";
  const canEvents = perms.EVENTS === "WRITE";

  const now = new Date();
  const [
    activeMembers,
    upcomingCount,
    achievementCount,
    pendingMemberships,
    pendingClaims,
    upcomingEvents,
    otherAssoCount,
  ] = await Promise.all([
    prisma.associationMember.count({ where: { associationId: id, status: "ACTIVE" } }),
    prisma.event.count({ where: { associationId: id, endDate: { gte: now } } }),
    prisma.achievement.count({ where: { associationId: id } }),
    canMembers
      ? prisma.associationMember.count({ where: { associationId: id, status: "PENDING" } })
      : Promise.resolve(0),
    canAchievements
      ? prisma.achievementClaim.count({
          where: { status: "PENDING", achievement: { associationId: id } },
        })
      : Promise.resolve(0),
    prisma.event.findMany({
      where: { associationId: id, endDate: { gte: now } },
      orderBy: { startDate: "asc" },
      take: 5,
      select: { id: true, title: true, startDate: true, location: true },
    }),
    prisma.associationMember.count({
      where: { userId: session.user.id, status: "ACTIVE", associationId: { not: id } },
    }),
  ]);

  const color = factionColor(association.nameNormalized);

  const stats = [
    { code: "01", label: "Membres actifs", value: activeMembers, c: "text-violet-bright" },
    { code: "02", label: "Événements à venir", value: upcomingCount, c: "text-lime" },
    { code: "03", label: "Hauts faits", value: achievementCount, c: "text-gold" },
  ];

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-hex">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
          <div
            className="absolute right-24 top-0 h-full w-16 -skew-x-[20deg]"
            style={{ background: color, opacity: 0.85 }}
          />
          <div className="absolute right-56 top-0 h-full w-6 -skew-x-[20deg] bg-violet/50" />
        </div>
        <div className="mx-auto max-w-7xl px-6 py-14">
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            Tableau de bord
          </p>
          <h1
            className="mt-2 font-display text-5xl font-bold uppercase leading-none md:text-7xl"
            style={{ color }}
          >
            {association.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {(membership?.roles ?? []).map((r) => (
              <span key={r.name} className="badge border-violet/50 bg-violet/10 text-violet-bright">
                {r.name}
              </span>
            ))}
            {!isMember && isPlatformAdmin && (
              <span className="badge border-gold/50 bg-gold/10 text-gold">Admin plateforme</span>
            )}
            {otherAssoCount > 0 && (
              <Link
                href="/dashboard"
                className="font-nav text-xs font-semibold uppercase tracking-wider text-lime hover:underline"
              >
                ⇄ Changer d'association
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-6 py-12">
        {/* Stats de l'association */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="panel relative overflow-hidden p-5">
              <span className={`font-display text-sm font-bold ${s.c}`}>{s.code}</span>
              <div className="mt-3 font-display text-5xl font-bold leading-none text-white">
                {s.value}
              </div>
              <div className="stat-label mt-2">{s.label}</div>
              <div className="absolute -right-2 bottom-0 h-1 w-16 -skew-x-[20deg] bg-current opacity-20" />
            </div>
          ))}
        </div>

        {/* À traiter (visible selon les droits) */}
        {(pendingMemberships > 0 || pendingClaims > 0) && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
              <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: color }} />
              À traiter
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {pendingMemberships > 0 && (
                <Link
                  href={`/associations/${id}/manage`}
                  className="panel flex items-center justify-between gap-3 p-5 transition hover:border-violet hover:shadow-neon-violet"
                >
                  <span className="font-body text-sm text-ink">
                    Adhésion{pendingMemberships > 1 ? "s" : ""} en attente d'approbation
                  </span>
                  <span className="badge badge-wait">{pendingMemberships}</span>
                </Link>
              )}
              {pendingClaims > 0 && (
                <Link
                  href={`/associations/${id}/hauts-faits/manage`}
                  className="panel flex items-center justify-between gap-3 p-5 transition hover:border-violet hover:shadow-neon-violet"
                >
                  <span className="font-body text-sm text-ink">
                    Réclamation{pendingClaims > 1 ? "s" : ""} de hauts faits à instruire
                  </span>
                  <span className="badge badge-wait">{pendingClaims}</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Outils de l'association, selon les droits */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
            <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: color }} />
            Modules
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              title="Fiche publique"
              description="La vitrine de l'association : présentation, membres, hauts faits."
              links={[{ href: `/associations/${id}`, label: "Voir la fiche" }]}
            />
            <ModuleCard
              title="Hauts faits"
              description="Les badges de l'association — réclamez les vôtres ou gérez le registre."
              links={[
                { href: `/associations/${id}/hauts-faits`, label: "Voir les hauts faits" },
                ...(canAchievements
                  ? [{ href: `/associations/${id}/hauts-faits/manage`, label: "Gérer" }]
                  : []),
              ]}
            />
            {canMembers && (
              <ModuleCard
                title="Membres & rôles"
                description="Adhésions, rôles et droits par module (RG-01)."
                links={[{ href: `/associations/${id}/manage`, label: "Administrer" }]}
              />
            )}
            {canEvents && (
              <ModuleCard
                title="Événements"
                description="Créer et organiser les événements, inscriptions et kanban."
                links={[{ href: `/associations/${id}/events`, label: "Gérer les événements" }]}
              />
            )}
          </div>
        </section>

        {/* Prochains événements de l'asso */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
            <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: color }} />
            Prochains événements
          </h2>
          {upcomingEvents.length === 0 ? (
            <div className="border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
              Aucun événement à venir.
            </div>
          ) : (
            <ol className="space-y-2">
              {upcomingEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="panel flex flex-wrap items-center gap-3 p-4 transition hover:border-violet hover:shadow-neon-violet"
                  >
                    <span className="w-32 shrink-0 font-nav text-xs uppercase tracking-wider text-ink-faint">
                      {dateFmt.format(e.startDate)}
                    </span>
                    <span className="flex-1 font-display text-lg font-bold uppercase text-white">
                      {e.title}
                    </span>
                    {e.location && (
                      <span className="font-nav text-xs uppercase tracking-wider text-ink-soft">
                        {e.location}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function ModuleCard({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="panel flex flex-col gap-3 p-5">
      <h3 className="font-display text-xl font-bold uppercase text-white">{title}</h3>
      <p className="flex-1 font-body text-sm text-ink-soft">{description}</p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="btn btn-ghost !px-3 !py-1.5 !text-[0.65rem]">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
