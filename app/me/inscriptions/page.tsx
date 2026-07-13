import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const REG_BADGE: Record<string, string> = {
  APPROVED: "badge-ok",
  PENDING: "badge-wait",
  REJECTED: "badge-no",
  CANCELLED: "badge-no",
};
const REG_LABEL: Record<string, string> = {
  APPROVED: "Validée",
  PENDING: "En attente",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};
const DOSSIER_BADGE: Record<string, string> = {
  APPROVED: "badge-ok",
  PENDING: "badge-wait",
  REJECTED: "badge-no",
};
const DOSSIER_LABEL: Record<string, string> = {
  APPROVED: "Dossier validé",
  PENDING: "Dossier en attente",
  REJECTED: "Dossier refusé",
};

// Vue agrégée : toutes mes inscriptions (et invitations en attente) sans
// avoir à rouvrir chaque événement.
export default async function MyRegistrationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    role: session.user.role,
  };

  const [registrations, invitations] = await Promise.all([
    prisma.registration.findMany({
      where: { userId: session.user.id },
      orderBy: { event: { startDate: "asc" } },
      include: {
        event: {
          select: { id: true, title: true, startDate: true, endDate: true, location: true, requiresCostume: true },
        },
        characterRole: { select: { name: true } },
        dossier: { select: { status: true } },
      },
    }),
    prisma.eventInvitation.findMany({
      where: {
        status: "PENDING",
        OR: [
          { userId: session.user.id },
          ...(session.user.email
            ? [{ email: { equals: session.user.email, mode: "insensitive" as const } }]
            : []),
        ],
      },
      include: {
        event: { select: { id: true, title: true, startDate: true } },
      },
    }),
  ]);

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <div>
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            {session.user.name}
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold text-white">Mes inscriptions</h1>
        </div>

        {invitations.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold uppercase text-white">
              Invitations reçues <span className="badge badge-wait">{invitations.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {invitations.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/events/${inv.event.id}`}
                    className="panel flex flex-wrap items-center gap-3 p-4 transition hover:border-violet hover:shadow-neon-violet"
                  >
                    <span className="w-28 shrink-0 font-nav text-xs uppercase tracking-wider text-ink-faint">
                      {dateFmt.format(inv.event.startDate)}
                    </span>
                    <span className="flex-1 font-display text-lg font-bold uppercase text-white">
                      {inv.event.title}
                    </span>
                    <span className="badge badge-wait">Répondre à l'invitation</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-bold uppercase text-white">
            Inscriptions · {registrations.length}
          </h2>
          {registrations.length === 0 ? (
            <div className="border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
              Aucune inscription pour l'instant —{" "}
              <Link href="/events" className="text-lime hover:underline">
                parcourez les événements
              </Link>
              .
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {registrations.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/events/${r.event.id}`}
                    className="panel flex flex-wrap items-center gap-3 p-4 transition hover:border-violet hover:shadow-neon-violet"
                  >
                    <span className="w-28 shrink-0 font-nav text-xs uppercase tracking-wider text-ink-faint">
                      {dateFmt.format(r.event.startDate)}
                    </span>
                    <span className="min-w-40 flex-1">
                      <span className="block font-display text-lg font-bold uppercase text-white">
                        {r.event.title}
                      </span>
                      {r.event.location && (
                        <span className="font-nav text-xs uppercase tracking-wider text-ink-soft">
                          {r.event.location}
                        </span>
                      )}
                    </span>
                    {r.characterRole && (
                      <span className="badge border-violet/50 bg-violet/10 text-violet-bright">
                        ⚔ {r.characterRole.name}
                      </span>
                    )}
                    {r.event.requiresCostume && r.status !== "CANCELLED" && (
                      <span className={`badge ${r.dossier ? DOSSIER_BADGE[r.dossier.status] : "badge-no"}`}>
                        {r.dossier ? DOSSIER_LABEL[r.dossier.status] : "Dossier à déposer"}
                      </span>
                    )}
                    <span className={`badge ${REG_BADGE[r.status]}`}>{REG_LABEL[r.status] ?? r.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
