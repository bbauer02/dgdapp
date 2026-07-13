import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModule, APP_MODULES, MODULE_LABELS } from "@/lib/permissions";
import {
  approveMembershipAction,
  rejectMembershipAction,
} from "@/lib/actions/associations";
import { factionColor, initials } from "@/lib/faction";
import MemberRolesEditor from "@/components/associations/MemberRolesEditor";
import RolesManager, { type ModuleOption } from "@/components/associations/RolesManager";
import AssociationSettingsForm from "@/components/associations/AssociationSettingsForm";
import type { SocialLink } from "@/components/admin/SocialLinksField";

function SectionTitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
      <span className="inline-block h-4 w-8 -skew-x-[20deg]" style={{ background: color }} />
      {children}
    </h2>
  );
}

export default async function ManageAssociationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Garde RG-01 : gestion réservée au droit MEMBRES/Écriture (admin d'asso).
  await requireModule(id, "MEMBERS", "WRITE");

  const association = await prisma.association.findUnique({
    where: { id },
    include: {
      memberships: {
        orderBy: { user: { lastName: "asc" } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          roles: { select: { id: true, name: true } },
        },
      },
      roles: {
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        include: { permissions: { select: { module: true, level: true } } },
      },
    },
  });
  if (!association) notFound();

  const color = factionColor(association.nameNormalized);
  const pending = association.memberships.filter((m) => m.status === "PENDING");
  const active = association.memberships.filter((m) => m.status === "ACTIVE");
  const roleOptions = association.roles.map((r) => ({ id: r.id, name: r.name }));
  const modules: ModuleOption[] = APP_MODULES.map((m) => ({
    value: m,
    label: MODULE_LABELS[m],
  }));

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-12 px-6 py-12">
        <div>
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            Membres &amp; rôles
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold" style={{ color }}>
            Gérer {association.name}
          </h1>
        </div>

        {/* Adhésions en attente (RF-10) */}
        {(association.requiresApproval || pending.length > 0) && (
          <section className="space-y-4">
            <SectionTitle color={color}>
              Adhésions en attente{" "}
              <span className="badge badge-wait">{pending.length}</span>
            </SectionTitle>
            {pending.length === 0 ? (
              <p className="font-nav text-sm text-ink-soft">Aucune demande en attente.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.map((m) => (
                  <li key={m.id} className="panel flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center font-display font-bold text-base"
                        style={{ background: color }}
                      >
                        {initials(m.user.firstName, m.user.lastName)}
                      </div>
                      <div>
                        <div className="font-display font-bold uppercase text-white">
                          {m.user.firstName} {m.user.lastName}
                        </div>
                        <div className="stat-label">
                          Demande du {m.joinedAt.toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <form action={approveMembershipAction.bind(null, m.id)}>
                        <button className="btn btn-lime px-4 py-1.5 text-[0.65rem]">Valider</button>
                      </form>
                      <form action={rejectMembershipAction.bind(null, m.id)}>
                        <button className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-danger">
                          Refuser
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Membres + rôles (RF-09 : cumul des rôles autorisé) */}
        <section className="space-y-4">
          <SectionTitle color={color}>Membres · {active.length}</SectionTitle>
          {active.length === 0 ? (
            <p className="font-nav text-sm text-ink-soft">Aucun membre actif.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((m) => (
                <li
                  key={m.id}
                  className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <Link href={`/players/${m.user.id}`} className="flex shrink-0 items-center gap-3">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center font-display font-bold text-base"
                      style={{ background: color }}
                    >
                      {initials(m.user.firstName, m.user.lastName)}
                    </div>
                    <div>
                      <div className="font-display font-bold uppercase text-white">
                        {m.user.firstName} {m.user.lastName}
                      </div>
                      <div className="stat-label">
                        Membre depuis le {m.joinedAt.toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </Link>
                  <div className="sm:max-w-md">
                    <MemberRolesEditor
                      memberId={m.id}
                      allRoles={roleOptions}
                      currentRoleIds={m.roles.map((r) => r.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Rôles & droits (RF-07/08) */}
        <section className="space-y-4">
          <SectionTitle color={color}>Rôles &amp; droits</SectionTitle>
          <p className="max-w-2xl font-nav text-xs uppercase tracking-wider text-ink-faint">
            Le nom d'un rôle ne donne aucun droit : seuls les droits par module comptent.
            Écriture inclut la lecture.
          </p>
          <RolesManager
            associationId={id}
            roles={association.roles.map((r) => ({
              id: r.id,
              name: r.name,
              isDefault: r.isDefault,
              permissions: r.permissions,
            }))}
            modules={modules}
          />
        </section>

        {/* Paramètres */}
        <section className="space-y-4">
          <SectionTitle color={color}>Paramètres</SectionTitle>
          <AssociationSettingsForm
            associationId={id}
            defaults={{
              name: association.name,
              description: association.description ?? "",
              requiresApproval: association.requiresApproval,
              logoUrl: association.logoUrl,
              bannerUrl: association.bannerUrl,
              socialLinks: ((association.socialLinks as SocialLink[]) ?? []).filter(
                (l) => l && l.label && l.url
              ),
            }}
          />
        </section>
      </div>
    </main>
  );
}
