import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getEffectivePermissions,
  type EffectivePermissions,
} from "@/lib/permissions";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import AssoSideNav, { type AssoNavItem } from "@/components/associations/AssoSideNav";
import { factionColor } from "@/lib/faction";

// L'espace de gestion d'UNE association : même header que partout, sidebar
// des modules selon les droits (RG-01). Les pages enfants gardent leurs
// gardes fines ; ici on ne laisse entrer que les membres actifs (ou l'ADMIN
// plateforme) — sinon retour à la fiche publique.
export default async function AssoGestionLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const isPlatformAdmin = session.user.role === "ADMIN";

  const [association, membership] = await Promise.all([
    prisma.association.findUnique({
      where: { id },
      select: { id: true, name: true, nameNormalized: true },
    }),
    prisma.associationMember.findUnique({
      where: { userId_associationId: { userId: session.user.id, associationId: id } },
      select: { status: true },
    }),
  ]);
  if (!association) notFound();
  if (membership?.status !== "ACTIVE" && !isPlatformAdmin) {
    redirect(`/associations/${id}`);
  }

  const perms: EffectivePermissions = isPlatformAdmin
    ? { EVENTS: "WRITE", FINANCES: "WRITE", MEMBERS: "WRITE", CARTOGRAPHY: "WRITE", ACHIEVEMENTS: "WRITE" }
    : await getEffectivePermissions(session.user.id, id);

  const items: AssoNavItem[] = [
    { href: `/associations/${id}/dashboard`, label: "Tableau de bord" },
    ...(perms.MEMBERS === "WRITE"
      ? [{ href: `/associations/${id}/manage`, label: "Membres & rôles" }]
      : []),
    ...(perms.EVENTS === "WRITE"
      ? [{ href: `/associations/${id}/events`, label: "Événements" }]
      : []),
    ...(perms.ACHIEVEMENTS === "WRITE"
      ? [{ href: `/associations/${id}/hauts-faits/manage`, label: "Hauts faits" }]
      : []),
    { href: `/associations/${id}`, label: "Fiche publique", exact: true },
  ];

  const headerUser: HeaderUser = {
    id: session.user.id,
    name: session.user.name ?? "Profil",
    image: session.user.image ?? null,
    role: session.user.role,
  };
  const color = factionColor(association.nameNormalized);

  return (
    <div className="flex min-h-screen flex-col bg-base">
      <SiteHeader user={headerUser} />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-hair bg-surface md:flex">
          <span
            className="kicker block truncate border-b border-hair p-4"
            style={{ color }}
            title={association.name}
          >
            {association.name}
          </span>
          <AssoSideNav items={items} color={color} />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
