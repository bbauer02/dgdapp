import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/permissions";
import { setRegistrationStatus } from "@/lib/actions/registrations";
import { RolePortrait, RoleBadge } from "@/components/roles/Role";
import { ROLE_META } from "@/lib/roles";
import { initials } from "@/lib/faction";
import { toDossierView, dossierInclude } from "@/lib/dossier-view";
import DossierReviewCard from "@/components/dossiers/DossierReviewCard";
import EventTabs from "@/components/associations/EventTabs";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "badge-ok",
  PENDING: "badge-wait",
  REJECTED: "badge-no",
  CANCELLED: "badge-no",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Validée",
  PENDING: "En attente",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

export default async function InscritsPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;
  // RG-01 : Écriture sur Événements de l'association organisatrice.
  await requireModule(id, "EVENTS", "WRITE");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      registrations: {
        include: {
          user: { include: { association: true } },
          dossier: { include: dossierInclude },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event || event.associationId !== id) notFound();

  // Sort by rank (chevalier first), then name.
  const regs = [...event.registrations].sort((a, b) => {
    const ta = a.role ? ROLE_META[a.role].tier : 99;
    const tb = b.role ? ROLE_META[b.role].tier : 99;
    return ta - tb;
  });

  const counts = {
    total: regs.length,
    approved: regs.filter((r) => r.status === "APPROVED").length,
    pending: regs.filter((r) => r.status === "PENDING").length,
  };

  return (
    <div className="p-8">
      <Link
        href={`/associations/${id}/events`}
        className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
      >
        ← Événements
      </Link>
      <div className="mt-3">
        <h1 className="mb-4 font-display text-4xl font-bold text-white">{event.title}</h1>
        <EventTabs
          base={`/associations/${id}/events/${event.id}`}
          registrationCount={counts.total}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="kicker">Registre des inscrits</p>
        <div className="flex gap-6">
          <Stat label="Total" value={counts.total} color="text-white" />
          <Stat label="Validés" value={counts.approved} color="text-lime" />
          <Stat label="En attente" value={counts.pending} color="text-gold" />
        </div>
      </div>

      {regs.length === 0 ? (
        <p className="mt-8 font-nav text-ink-soft">Aucun inscrit pour l'instant.</p>
      ) : (
        <div className="panel mt-6 divide-y divide-hair">
          {regs.map((r) => {
            const approve = setRegistrationStatus.bind(null, r.id, event.id, "APPROVED");
            const reject = setRegistrationStatus.bind(null, r.id, event.id, "REJECTED");
            return (
              <div key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                <RolePortrait
                  initials={initials(r.user.firstName, r.user.lastName)}
                  role={r.role}
                  size={52}
                />
                <div className="min-w-40 flex-1">
                  <Link
                    href={`/players/${r.user.id}`}
                    className="font-display text-lg font-bold uppercase text-white hover:text-lime"
                  >
                    {r.user.firstName} {r.user.lastName}
                  </Link>
                  <div className="font-nav text-xs uppercase tracking-wider text-ink-soft">
                    {r.user.association?.name ?? "Sans association"}
                  </div>
                </div>

                <RoleBadge role={r.role} />

                <div className="w-20 text-right font-display font-bold text-white">
                  {r.roleFee ? euro.format(Number(r.roleFee)) : "—"}
                </div>

                <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span>

                <div className="flex gap-2">
                  <form action={approve}>
                    <button
                      disabled={r.status === "APPROVED"}
                      className="rounded-full border border-lime/50 px-3 py-1.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-lime transition hover:bg-lime/10 disabled:opacity-30"
                    >
                      Valider
                    </button>
                  </form>
                  <form action={reject}>
                    <button
                      disabled={r.status === "REJECTED"}
                      className="rounded-full border border-danger/50 px-3 py-1.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10 disabled:opacity-30"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
                </div>

                {/* Dossier costume (RF-15, RG-03) */}
                {(event.requiresCostume || r.dossier) && r.status !== "CANCELLED" && (
                  <div className="mt-4 pl-[68px]">
                    <DossierReviewCard dossier={toDossierView(r.dossier)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-right">
      <div className={`font-display text-3xl font-bold leading-none ${color}`}>{value}</div>
      <div className="stat-label mt-1">{label}</div>
    </div>
  );
}
