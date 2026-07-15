import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";
import EventForm from "@/components/admin/EventForm";
import PackageForm from "@/components/admin/PackageForm";
import CharacterRoleForm from "@/components/admin/CharacterRoleForm";
import InviteForm from "@/components/admin/InviteForm";
import EventTabs from "@/components/associations/EventTabs";
import {
  updateEvent,
  deleteEvent,
  deletePackage,
  deleteCharacterRole,
} from "@/lib/actions/events";
import { revokeInvitationAction } from "@/lib/actions/invitations";
import type { SocialLink } from "@/components/admin/SocialLinksField";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;
  // RG-01: Écriture sur Événements de l'association organisatrice.
  await requireEventModule(eventId, "EVENTS", "WRITE");
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      association: { select: { id: true, name: true } },
      packages: { orderBy: { createdAt: "asc" } },
      characterRoles: {
        orderBy: { createdAt: "asc" },
        include: { package: { select: { name: true, price: true } } },
      },
      invitations: { orderBy: { createdAt: "desc" } },
      _count: { select: { registrations: true } },
    },
  });
  // L'événement doit appartenir à l'asso de l'espace courant.
  if (!event || event.associationId !== id) notFound();

  const updateAction = updateEvent.bind(null, event.id);
  const deleteAction = deleteEvent.bind(null, event.id);
  const base = `/associations/${id}/events/${event.id}`;

  return (
    <div className="max-w-2xl p-8">
      <Link
        href={`/associations/${id}/events`}
        className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
      >
        ← Événements
      </Link>
      <div className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-bold text-white">{event.title}</h1>
        <Link href={`/events/${event.id}`} className="btn btn-ghost !px-3 !py-1.5 !text-[0.65rem]">
          Voir la fiche publique
        </Link>
      </div>

      <EventTabs base={base} registrationCount={event._count.registrations} />

      <EventForm
        action={updateAction}
        submitLabel="Enregistrer"
        associations={event.association ? [event.association] : []}
        defaults={{
          title: event.title,
          description: event.description ?? "",
          startDate: toLocalInput(event.startDate),
          endDate: toLocalInput(event.endDate),
          associationId: event.associationId ?? "",
          visibility: event.visibility,
          location: event.location ?? "",
          position:
            event.latitude != null && event.longitude != null
              ? { lat: event.latitude, lng: event.longitude }
              : null,
          requiresCostume: event.requiresCostume,
          maxParticipants: event.maxParticipants?.toString() ?? "",
          logoUrl: event.logoUrl,
          bannerUrl: event.bannerUrl,
          socialLinks: (event.socialLinks as SocialLink[]) ?? [],
        }}
      />

      {/* Rôles incarnables — statuts sociaux configurables, liés à une formule */}
      <section className="mt-12">
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
          <span className="slash" aria-hidden />
          Rôles incarnables
        </h2>
        <p className="mt-2 font-nav text-xs text-ink-soft">
          Statuts sociaux que les joueurs peuvent endosser (soldat, chevalier…),
          chacun pouvant être associé à une formule de prix.
        </p>
        {event.characterRoles.length === 0 ? (
          <p className="mt-3 font-nav text-sm text-ink-soft">Aucun rôle défini.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {event.characterRoles.map((r) => (
              <li key={r.id} className="panel flex items-start justify-between gap-3 p-3">
                <div>
                  <div className="font-display font-bold uppercase text-white">{r.name}</div>
                  <div className="mt-1 font-nav text-xs uppercase tracking-wider text-ink-soft">
                    {r.package
                      ? `Formule : ${r.package.name} — ${euro.format(Number(r.package.price))}`
                      : "Sans formule associée"}
                  </div>
                  {r.description && (
                    <p className="mt-1 font-nav text-xs text-ink-faint">{r.description}</p>
                  )}
                </div>
                <form action={deleteCharacterRole.bind(null, r.id, event.id)}>
                  <button className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-danger">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <CharacterRoleForm
            eventId={event.id}
            packages={event.packages.map((p) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
            }))}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
          <span className="slash" aria-hidden />
          Formules
        </h2>
        {event.packages.length === 0 ? (
          <p className="mt-3 font-nav text-sm text-ink-soft">Aucune formule.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {event.packages.map((p) => (
              <li key={p.id} className="panel flex items-start justify-between gap-3 p-3">
                <div>
                  <div className="font-display font-bold uppercase text-white">
                    {p.name} — <span className="text-lime">{euro.format(Number(p.price))}</span>
                  </div>
                  {p.includedItems.length > 0 && (
                    <div className="mt-1 font-nav text-xs uppercase tracking-wider text-ink-soft">
                      {p.includedItems.join(" · ")}
                    </div>
                  )}
                </div>
                <form action={deletePackage.bind(null, p.id, event.id)}>
                  <button className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-danger">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <PackageForm eventId={event.id} />
        </div>
      </section>

      {/* Invitations — extérieurs à l'association (événements privés inclus) */}
      <section className="mt-12">
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
          <span className="slash" aria-hidden />
          Invitations
        </h2>
        <p className="mt-2 font-nav text-xs text-ink-soft">
          Invitez des personnes extérieures à l'association (nom prénom d'un
          compte existant, ou email). L'invité reçoit une notification sur la
          plateforme et un email, et reste en attente jusqu'à sa réponse.
        </p>
        {event.invitations.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {event.invitations.map((inv) => (
              <li key={inv.id} className="panel flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <span className="font-display font-bold uppercase text-white">
                    {inv.firstName || inv.lastName
                      ? `${inv.firstName ?? ""} ${inv.lastName ?? ""}`.trim()
                      : inv.email}
                  </span>
                  <span className="ml-2 font-nav text-xs text-ink-soft">{inv.email}</span>
                </div>
                <span
                  className={`badge ${
                    inv.status === "ACCEPTED"
                      ? "badge-ok"
                      : inv.status === "DECLINED"
                        ? "badge-no"
                        : "badge-wait"
                  }`}
                >
                  {inv.status === "ACCEPTED"
                    ? "Acceptée"
                    : inv.status === "DECLINED"
                      ? "Refusée"
                      : "En attente"}
                </span>
                <form action={revokeInvitationAction.bind(null, inv.id)}>
                  <button className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-danger">
                    Révoquer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <InviteForm eventId={event.id} />
        </div>
      </section>

      <section className="mt-12 border-t border-hair pt-6">
        <form action={deleteAction}>
          <button className="rounded-full border border-danger/50 bg-danger/10 px-4 py-2 font-nav text-xs font-semibold uppercase tracking-wider text-danger hover:bg-danger/20">
            Supprimer cet événement
          </button>
        </form>
      </section>
    </div>
  );
}
