import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { initials } from "@/lib/faction";
import { canViewEvent } from "@/lib/event-visibility";
import { eventPriceLabel } from "@/lib/event-pricing";
import { checkModule } from "@/lib/permissions";
import {
  registerToEventAction,
  cancelMyRegistrationAction,
} from "@/lib/actions/registrations";
import { toDossierView, dossierInclude } from "@/lib/dossier-view";
import DossierPanel from "@/components/dossiers/DossierPanel";
import Markdown from "@/components/ui/Markdown";
import { respondToInvitationAction } from "@/lib/actions/invitations";
import type { SocialLink } from "@/components/admin/SocialLinksField";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

const REG_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

const REG_STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-wait",
  APPROVED: "badge-ok",
  REJECTED: "badge-no",
  CANCELLED: "badge-no",
};

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (24 * 3600 * 1000)) + 1);
}

export default async function EventDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      association: true,
      packages: { orderBy: { price: "asc" } },
      characterRoles: {
        orderBy: { createdAt: "asc" },
        include: { package: { select: { name: true, price: true } } },
      },
      registrations: {
        include: {
          user: { include: { association: true } },
          characterRole: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) notFound();

  // RF-12: a MEMBERS event is invisible to non-members (behaves as if it
  // did not exist).
  if (!(await canViewEvent(session, event))) notFound();

  // Invitation du visiteur (extérieur invité) — matchée par compte ou email.
  const myInvitation = session
    ? await prisma.eventInvitation.findFirst({
        where: {
          eventId: event.id,
          OR: [
            { userId: session.user.id },
            ...(session.user.email
              ? [{ email: { equals: session.user.email, mode: "insensitive" as const } }]
              : []),
          ],
        },
      })
    : null;

  const socialLinks = ((event.socialLinks as SocialLink[]) ?? []).filter(
    (l) => l && l.label && l.url
  );

  // Passerelle public → gestion en un clic pour les organisateurs (RG-01).
  const canManage =
    session && event.associationId
      ? await checkModule(event.associationId, "EVENTS", "WRITE")
      : false;

  // RF-13: the viewer's own registration (if any) + their costume dossier.
  const myRegistration = session
    ? event.registrations.find((r) => r.userId === session.user.id) ?? null
    : null;
  const myDossier =
    myRegistration && event.requiresCostume && myRegistration.status !== "CANCELLED"
      ? await prisma.costumeDossier.findUnique({
          where: { registrationId: myRegistration.id },
          include: dossierInclude,
        })
      : null;

  const approved = event.registrations.filter((r) => r.status === "APPROVED");
  const stats = [
    {
      label: "Participants",
      value: `${event.registrations.length}${
        event.maxParticipants != null ? ` / ${event.maxParticipants}` : ""
      }`,
      accent: true,
    },
    { label: "Tarif", value: eventPriceLabel(event.packages.map((p) => Number(p.price))) },
    { label: "Formules", value: `${event.packages.length}` },
    { label: "Durée", value: `${daysBetween(event.startDate, event.endDate)} j` },
  ];

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      {/* Hero — la bannière uploadée devient le bandeau d'en-tête */}
      <section
        className="relative overflow-hidden bg-hex bg-cover bg-center"
        style={
          event.bannerUrl
            ? {
                backgroundImage: `linear-gradient(rgba(18,16,26,0.72), rgba(18,16,26,0.9)), url('${event.bannerUrl}')`,
              }
            : undefined
        }
      >
        {!event.bannerUrl && (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
            <div className="absolute right-24 top-0 h-full w-16 -skew-x-[20deg] bg-lime/80" />
            <div className="absolute right-56 top-0 h-full w-6 -skew-x-[20deg] bg-violet/50" />
          </div>
        )}

        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            {dateFmt.format(event.startDate)} — {dateFmt.format(event.endDate)}
          </p>
          <div className="mt-2 flex items-center gap-6">
            {event.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.logoUrl}
                alt={`Logo ${event.title}`}
                className="h-20 w-20 shrink-0 border border-hair bg-surface object-cover md:h-28 md:w-28"
              />
            )}
            <h1 className="font-display text-6xl font-bold leading-none text-white md:text-8xl">
              {event.title}
            </h1>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-nav text-sm text-ink-soft">
            {event.association && (
              <span>
                Organisé par{" "}
                <Link
                  href={`/associations/${event.association.id}`}
                  className="font-bold uppercase tracking-wider text-lime hover:underline"
                >
                  {event.association.name}
                </Link>
              </span>
            )}
            {event.location && (
              <span>
                Lieu : <span className="text-ink">{event.location}</span>
              </span>
            )}
            {event.visibility === "MEMBERS" && (
              <span className="badge badge-wait">Réservé aux membres</span>
            )}
            {socialLinks.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="badge border-hair bg-surface text-ink-soft transition hover:border-lime hover:text-lime"
              >
                ↗ {l.label}
              </a>
            ))}
            {canManage && (
              <Link
                href={`/associations/${event.associationId}/events/${event.id}`}
                className="badge border-violet/50 bg-violet/10 text-violet-bright transition hover:border-violet hover:text-white"
              >
                ⚙ Administrer
              </Link>
            )}
          </div>

          {event.description && (
            <div className="mt-6 max-w-2xl">
              <Markdown>{event.description}</Markdown>
            </div>
          )}

          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="stat-label">{s.label}</dt>
                <dd
                  className="stat-value mt-1"
                  style={{ color: s.accent ? "#A3FF12" : "#fff" }}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-6 py-12">
        {/* Mon inscription (RF-13) */}
        <section id="inscription">
          <SectionTitle color="#FFC24B">Mon inscription</SectionTitle>
          <div className="mt-5 max-w-2xl space-y-5">
            {/* Invitation en attente : l'invité répond ici (in-app) */}
            {myInvitation?.status === "PENDING" && (
              <div className="panel flex flex-wrap items-center justify-between gap-4 border-violet/50 p-5">
                <p className="font-nav text-sm text-ink">
                  ✉ Vous êtes invité·e à cet événement.
                </p>
                <div className="flex gap-2">
                  <form action={respondToInvitationAction.bind(null, myInvitation.id, true)}>
                    <button type="submit" className="btn btn-lime !px-4 !py-2">
                      Accepter
                    </button>
                  </form>
                  <form action={respondToInvitationAction.bind(null, myInvitation.id, false)}>
                    <button
                      type="submit"
                      className="rounded-full border border-danger/50 px-4 py-2 font-nav text-xs font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
              </div>
            )}
            {myInvitation?.status === "ACCEPTED" && (
              <p className="font-nav text-xs uppercase tracking-wider text-lime">
                ✓ Invitation acceptée — vous pouvez vous inscrire.
              </p>
            )}

            {!session ? (
              <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
                <p className="font-nav text-sm text-ink-soft">
                  Connectez-vous pour vous inscrire à cet événement.
                </p>
                <Link href="/login" className="btn btn-primary">
                  Se connecter
                </Link>
              </div>
            ) : !myRegistration || myRegistration.status === "CANCELLED" ? (
              <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
                <p className="font-nav text-sm text-ink-soft">
                  {myRegistration?.status === "CANCELLED"
                    ? "Vous avez annulé votre inscription. Vous pouvez vous réinscrire."
                    : "Vous n'êtes pas encore inscrit à cet événement."}
                </p>
                <form
                  action={registerToEventAction.bind(null, event.id)}
                  className="flex flex-wrap items-center gap-2"
                >
                  {event.characterRoles.length > 0 && (
                    <select
                      name="characterRoleId"
                      defaultValue=""
                      className="rounded-none border border-hair bg-base px-3 py-2 font-nav text-xs text-ink outline-none transition focus:border-violet"
                    >
                      <option value="">Rôle incarné — au choix</option>
                      {event.characterRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.package ? ` (${r.package.name} — ${Number(r.package.price).toFixed(2)} €)` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="submit" className="btn btn-lime">
                    S'inscrire
                  </button>
                </form>
              </div>
            ) : (
              <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="font-nav text-sm text-ink-soft">Statut :</span>
                  <span className={`badge ${REG_STATUS_BADGE[myRegistration.status]}`}>
                    {REG_STATUS_LABEL[myRegistration.status]}
                  </span>
                  {myRegistration.characterRole && (
                    <span className="badge border-violet/50 bg-violet/10 text-violet-bright">
                      ⚔ {myRegistration.characterRole.name}
                    </span>
                  )}
                </div>
                <form action={cancelMyRegistrationAction.bind(null, event.id)}>
                  <button
                    type="submit"
                    className="rounded-full border border-danger/50 px-4 py-2 font-nav text-xs font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10"
                  >
                    Annuler mon inscription
                  </button>
                </form>
              </div>
            )}

            {/* Dossier costume (RF-14..16) */}
            {event.requiresCostume &&
              myRegistration &&
              myRegistration.status !== "CANCELLED" && (
                <DossierPanel
                  registrationId={myRegistration.id}
                  dossier={toDossierView(myDossier)}
                />
              )}
          </div>
        </section>

        {/* Formules */}
        <section id="formules">
          <SectionTitle color="#A3FF12">Formules</SectionTitle>
          {event.packages.length === 0 ? (
            <EmptyState>Aucune formule proposée.</EmptyState>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {event.packages.map((pkg) => (
                <div key={pkg.id} className="panel relative overflow-hidden p-5">
                  <span className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg] bg-lime" />
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-display text-xl font-bold uppercase text-white">
                      {pkg.name}
                    </div>
                    <div className="font-display text-xl font-bold text-lime">
                      {Number(pkg.price).toFixed(2)} €
                    </div>
                  </div>
                  {pkg.description && (
                    <div className="mt-3">
                      <Markdown>{pkg.description}</Markdown>
                    </div>
                  )}
                  {pkg.includedItems.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {pkg.includedItems.map((item, i) => (
                        <span key={i} className="badge badge-ok">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : !pkg.description ? (
                    <p className="mt-4 font-nav text-sm text-ink-faint">Aucune prestation détaillée.</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Participants */}
        <section id="participants">
          <SectionTitle color="#7C4DFF">Participants</SectionTitle>
          {approved.length === 0 ? (
            <EmptyState>Aucun participant validé pour le moment.</EmptyState>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {approved.map((r) => {
                const u = r.user;
                return (
                  <Link
                    key={r.id}
                    href={`/players/${u.id}`}
                    className="panel group flex items-center gap-4 p-4 transition hover:border-violet hover:shadow-neon-violet"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center bg-surface-raised font-display text-lg font-bold text-white">
                      {initials(u.firstName, u.lastName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-display text-lg font-bold uppercase text-white">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="truncate font-nav text-xs uppercase tracking-wider text-ink-soft">
                        {u.association?.name ?? "Sans association"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <Link
          href="/events"
          className="inline-block font-nav text-xs uppercase tracking-wider text-lime hover:underline"
        >
          ← Tous les événements
        </Link>
      </div>
    </main>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
      <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: color }} />
      {children}
    </h2>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
      {children}
    </div>
  );
}
