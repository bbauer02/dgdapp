import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listWritableAssociations } from "@/lib/permissions";
import { factionColor, initials } from "@/lib/faction";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  // Supervision plateforme : les organisateurs gèrent depuis leur asso.
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const isPlatformAdmin = true;

  // Associations que l'utilisateur administre, par module (RG-01).
  const [eventAssos, memberAssos, achievementAssos] = await Promise.all([
    listWritableAssociations("EVENTS"),
    listWritableAssociations("MEMBERS"),
    listWritableAssociations("ACHIEVEMENTS"),
  ]);
  const byId = new Map<string, { id: string; name: string; nameNormalized: string }>();
  for (const a of [...eventAssos, ...memberAssos, ...achievementAssos]) {
    byId.set(a.id, { id: a.id, name: a.name, nameNormalized: a.nameNormalized });
  }
  const myAssos = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Périmètre des stats : les événements des assos administrées (tout pour
  // l'ADMIN plateforme).
  const eventScope = isPlatformAdmin
    ? {}
    : { associationId: { in: eventAssos.map((a) => a.id) } };

  const [eventCount, pendingRegs, pendingDossiers, pendingClaims] = await Promise.all([
    prisma.event.count({ where: eventScope }),
    prisma.registration.count({ where: { status: "PENDING", event: eventScope } }),
    prisma.costumeDossier.count({ where: { status: "PENDING", registration: { event: eventScope } } }),
    prisma.achievementClaim.count({
      where: {
        status: "PENDING",
        achievement: isPlatformAdmin
          ? {}
          : { associationId: { in: achievementAssos.map((a) => a.id) } },
      },
    }),
  ]);

  const stats = [
    { code: "01", label: "Événements", value: eventCount, href: "/admin/events", c: "text-violet-bright" },
    { code: "02", label: "Inscriptions en attente", value: pendingRegs, href: "/admin/events", c: "text-gold" },
    { code: "03", label: "Dossiers costume à traiter", value: pendingDossiers, href: "/admin/events", c: "text-lime" },
    // Les réclamations s'instruisent par association (hauts-faits/manage) —
    // pas de page agrégée : simple indicateur, sans lien.
    { code: "04", label: "Réclamations de hauts faits", value: pendingClaims, href: null, c: "text-faction-3" },
  ];

  return (
    <div className="p-8">
      <p className="kicker">Poste de commandement</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-white">Tableau de bord</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <div className="flex items-baseline justify-between">
                <span className={`font-display text-sm font-bold ${s.c}`}>{s.code}</span>
                {(s.label.includes("attente") || s.label.includes("traiter") || s.label.includes("Réclamations")) &&
                  s.value > 0 && <span className="badge badge-wait">à traiter</span>}
              </div>
              <div className="mt-3 font-display text-5xl font-bold leading-none text-white">
                {s.value}
              </div>
              <div className="stat-label mt-2">{s.label}</div>
              <div className="absolute -right-2 bottom-0 h-1 w-16 -skew-x-[20deg] bg-current opacity-20" />
            </>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="panel group relative overflow-hidden p-5 transition hover:border-violet hover:shadow-neon-violet"
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className="panel relative overflow-hidden p-5">
              {body}
            </div>
          );
        })}
      </div>

      {/* Les outils par asso (membres/rôles, hauts faits…) vivent dans le
          dashboard de CHAQUE association — ici, un simple renvoi. */}
      <section className="mt-10">
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
          <span className="slash" aria-hidden />
          Dashboards d'association
        </h2>
        {myAssos.length === 0 ? (
          <p className="mt-3 font-nav text-sm text-ink-soft">
            Vous n'administrez aucune association.{" "}
            <Link href="/associations/new" className="text-lime hover:underline">
              Créez la vôtre
            </Link>{" "}
            — vous en deviendrez Président.
          </p>
        ) : (
          <>
            <p className="mt-3 font-nav text-sm text-ink-soft">
              Membres, rôles, hauts faits et événements de chaque association se
              gèrent depuis son tableau de bord.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {myAssos.map((a) => {
                const color = factionColor(a.nameNormalized);
                return (
                  <Link
                    key={a.id}
                    href={`/associations/${a.id}/dashboard`}
                    className="group flex items-center gap-3 border border-hair bg-surface px-4 py-2.5 transition hover:border-violet hover:shadow-neon-violet"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center font-display text-sm font-bold"
                      style={{ border: `1px solid ${color}`, color }}
                    >
                      {initials(a.name, a.name.split(/\s+/)[1] ?? "")}
                    </span>
                    <span className="font-display text-base font-bold uppercase leading-none text-white group-hover:text-lime">
                      {a.name}
                    </span>
                    <span className="font-nav text-xs text-lime" aria-hidden>
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="mt-10 flex gap-3">
        <Link href="/admin/events" className="btn btn-primary">
          Gérer les événements
        </Link>
        <Link href="/admin/planner" className="btn btn-ghost">
          Ouvrir le plan de camp
        </Link>
        <Link href="/associations/new" className="btn btn-ghost">
          Créer une association
        </Link>
      </div>
    </div>
  );
}
