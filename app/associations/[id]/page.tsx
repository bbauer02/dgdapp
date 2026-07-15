import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkModule } from "@/lib/permissions";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor, initials } from "@/lib/faction";
import { playerValue } from "@/lib/renown";
import MembershipActions from "@/components/associations/MembershipActions";
import type { SocialLink } from "@/components/admin/SocialLinksField";

// Ordre protocolaire des rôles importants d'une association (RF-06). Tout rôle
// autre que "Membre" distingue son porteur dans la liste des membres.
const ROLE_RANK: Record<string, number> = {
  Président: 0,
  Trésorier: 1,
  Secrétaire: 2,
  "Membre du CA": 3,
};
const CUSTOM_ROLE_RANK = 10; // rôle nommé hors jeu par défaut (ex. "Capitaine")
const MEMBER_ONLY_RANK = 99; // uniquement "Membre" (ou sans rôle)

function memberRank(roles: { name: string }[]): number {
  const ranks = roles
    .filter((r) => r.name !== "Membre")
    .map((r) => ROLE_RANK[r.name] ?? CUSTOM_ROLE_RANK);
  return ranks.length > 0 ? Math.min(...ranks) : MEMBER_ONLY_RANK;
}

export default async function AssociationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;

  const { id } = await params;
  const association = await prisma.association.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { user: { lastName: "asc" } },
        include: {
          user: {
            include: {
              feats: { select: { points: true } },
              achievementAwards: {
                select: { achievement: { select: { points: true } } },
              },
            },
          },
          roles: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!association) notFound();

  const color = factionColor(association.nameNormalized);
  const members = association.memberships;

  const socialLinks = ((association.socialLinks as SocialLink[]) ?? []).filter(
    (l) => l && l.label && l.url
  );

  // Liste des membres : le bureau (rôles importants) d'abord, puis les membres.
  const board = members
    .filter((m) => memberRank(m.roles) < MEMBER_ONLY_RANK)
    .sort(
      (a, b) =>
        memberRank(a.roles) - memberRank(b.roles) ||
        a.user.lastName.localeCompare(b.user.lastName)
    );
  const rank = members.filter((m) => memberRank(m.roles) === MEMBER_ONLY_RANK);

  // Statut du visiteur vis-à-vis de l'association + droit de gestion.
  const myMembership = session
    ? await prisma.associationMember.findUnique({
        where: {
          userId_associationId: { userId: session.user.id, associationId: id },
        },
      })
    : null;
  const myStatus: "NONE" | "PENDING" | "ACTIVE" = myMembership?.status ?? "NONE";
  const canManage = session ? await checkModule(id, "MEMBERS", "WRITE") : false;

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      {/* Hero — la bannière uploadée devient le bandeau d'en-tête */}
      <section
        className="relative overflow-hidden bg-hex bg-cover bg-center"
        style={
          association.bannerUrl
            ? {
                backgroundImage: `linear-gradient(rgba(18,16,26,0.72), rgba(18,16,26,0.9)), url('${association.bannerUrl}')`,
              }
            : undefined
        }
      >
        {!association.bannerUrl && (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
            <div
              className="absolute right-24 top-0 h-full w-16 -skew-x-[20deg]"
              style={{ background: color, opacity: 0.85 }}
            />
            <div className="absolute right-56 top-0 h-full w-6 -skew-x-[20deg] bg-violet/50" />
          </div>
        )}

        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            Association · {members.length} membre{members.length > 1 ? "s" : ""}
            {association.requiresApproval && " · adhésion sur validation"}
          </p>
          <div className="mt-2 flex items-center gap-6">
            {association.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={association.logoUrl}
                alt={`Logo ${association.name}`}
                className="h-20 w-20 shrink-0 rounded-full border border-hair bg-surface object-cover md:h-28 md:w-28"
              />
            )}
            <h1
              className="font-display text-6xl font-bold leading-none md:text-8xl"
              style={{ color }}
            >
              {association.name}
            </h1>
          </div>
          {association.description && (
            <p className="mt-4 max-w-2xl font-body text-ink-soft">{association.description}</p>
          )}

          {socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {session ? (
              <MembershipActions associationId={id} status={myStatus} />
            ) : (
              <Link href="/login" className="btn btn-lime">
                Connectez-vous pour rejoindre
              </Link>
            )}
            <Link href={`/associations/${id}/hauts-faits`} className="btn btn-ghost">
              Hauts faits
            </Link>
            {canManage && (
              <Link href={`/associations/${id}/manage`} className="btn btn-primary">
                Gérer
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase text-white">
          <span
            className="inline-block h-4 w-8 -skew-x-[20deg]"
            style={{ background: color }}
          />
          Liste des membres
        </h2>

        {members.length === 0 ? (
          <div className="border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
            Aucun membre enrôlé dans cette association.
          </div>
        ) : (
          <>
            {/* Bureau & responsables — rôles importants mis en avant */}
            {board.length > 0 && (
              <section className="space-y-4">
                <h3 className="stat-label !text-gold">
                  Bureau &amp; responsables · {board.length}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {board.map((m) => (
                    <MemberCard key={m.id} membership={m} color={color} featured />
                  ))}
                </div>
              </section>
            )}

            {rank.length > 0 && (
              <section className="space-y-4">
                <h3 className="stat-label">Membres · {rank.length}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rank.map((m) => (
                    <MemberCard key={m.id} membership={m} color={color} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <Link
          href="/associations"
          className="inline-block font-nav text-xs uppercase tracking-wider text-lime hover:underline"
        >
          ← Toutes les associations
        </Link>
      </div>
    </main>
  );
}

type MembershipCard = {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    feats: { points: number }[];
    achievementAwards: { achievement: { points: number } }[];
  };
  roles: { id: string; name: string }[];
};

function MemberCard({
  membership: m,
  color,
  featured = false,
}: {
  membership: MembershipCard;
  color: string;
  featured?: boolean;
}) {
  const value = playerValue(m.user.feats, m.user.achievementAwards);
  // Sur une carte du bureau, les rôles importants passent devant "Membre".
  const roles = [...m.roles].sort(
    (a, b) =>
      (ROLE_RANK[a.name] ?? (a.name === "Membre" ? MEMBER_ONLY_RANK : CUSTOM_ROLE_RANK)) -
      (ROLE_RANK[b.name] ?? (b.name === "Membre" ? MEMBER_ONLY_RANK : CUSTOM_ROLE_RANK))
  );

  return (
    <Link
      href={`/players/${m.user.id}`}
      className={`panel group relative flex items-center gap-4 overflow-hidden p-4 transition hover:border-violet hover:shadow-neon-violet ${
        featured ? "border-gold/40" : ""
      }`}
    >
      {m.user.profilePicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={m.user.profilePicture}
          alt=""
          className="h-16 w-16 shrink-0 border border-hair bg-surface object-cover"
        />
      ) : (
        <div
          className="grid h-16 w-16 shrink-0 place-items-center font-display text-2xl font-bold text-base"
          style={{ background: color }}
        >
          {initials(m.user.firstName, m.user.lastName)}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-xl font-bold uppercase text-white">
          {m.user.firstName} {m.user.lastName}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {roles.length === 0 ? (
            <span className="font-nav text-xs uppercase tracking-wider text-ink-faint">
              Sans rôle
            </span>
          ) : (
            roles.map((r) =>
              r.name === "Membre" ? (
                <span
                  key={r.id}
                  className="border border-hair px-1.5 py-0.5 font-nav text-[0.6rem] font-semibold uppercase tracking-wider text-ink-faint"
                >
                  {r.name}
                </span>
              ) : (
                <span
                  key={r.id}
                  className="border px-1.5 py-0.5 font-nav text-[0.6rem] font-semibold uppercase tracking-wider"
                  style={
                    ROLE_RANK[r.name] !== undefined
                      ? { borderColor: "#FFC53D66", color: "#FFC53D" }
                      : { borderColor: `${color}66`, color }
                  }
                >
                  {r.name}
                </span>
              )
            )
          )}
        </div>
        <div className="stat-label mt-2 flex items-center gap-2">
          <span className="text-lime">★ {value}</span>
        </div>
      </div>
      <span
        className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg]"
        style={{ background: featured ? "#FFC53D" : color }}
      />
    </Link>
  );
}
