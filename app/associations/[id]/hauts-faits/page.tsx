import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkModule } from "@/lib/permissions";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor } from "@/lib/faction";
import ClaimButton from "@/components/achievements/ClaimButton";
import ClaimThread, { type ClaimThreadMessage } from "@/components/achievements/ClaimThread";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** Monogramme de secours quand le badge n'a pas d'icône. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[a-z0-9à-ÿ]/i.test(w[0] ?? ""));
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const PAGE_SIZE = 10;

// RF-23 — consultation des hauts faits d'une association (lisible public) ;
// l'utilisateur connecté voit en plus son statut sur chaque badge (RF-24/25).
export default async function AssociationAchievements({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: rawPage } = await searchParams;
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role, image: session.user.image ?? null }
    : null;
  const userId = session?.user.id ?? null;

  const association = await prisma.association.findUnique({
    where: { id },
    select: { id: true, name: true, nameNormalized: true },
  });
  if (!association) notFound();

  // Liste verticale paginée (10 par page), classée par valeur en renom
  // décroissante par défaut.
  const total = await prisma.achievement.count({ where: { associationId: id } });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(rawPage ?? "1", 10) || 1), pageCount);

  const achievements = await prisma.achievement.findMany({
    where: { associationId: id },
    orderBy: [{ points: "desc" }, { name: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Statut personnel du visiteur connecté sur chaque badge.
  const [myAwards, myClaims] = userId
    ? await Promise.all([
        prisma.achievementAward.findMany({
          where: { userId, achievement: { associationId: id } },
          orderBy: { awardedAt: "desc" },
        }),
        prisma.achievementClaim.findMany({
          where: { userId, achievement: { associationId: id } },
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { author: { select: { firstName: true, lastName: true } } },
            },
          },
        }),
      ])
    : [[], []];

  const canManage = await checkModule(id, "ACHIEVEMENTS", "WRITE");
  const color = factionColor(association.nameNormalized);

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

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
            <Link href={`/associations/${association.id}`} className="hover:underline">
              {association.name}
            </Link>
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none md:text-7xl" style={{ color }}>
            Hauts faits
          </h1>
          <p className="mt-4 max-w-xl font-nav text-sm text-ink-soft">
            Les badges de la compagnie : attribués sur le terrain, réclamés par les braves,
            journalisés pour la postérité.
          </p>
          {canManage && (
            <Link
              href={`/associations/${association.id}/hauts-faits/manage`}
              className="btn btn-primary mt-6 inline-flex"
            >
              Gérer les hauts faits
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        {!session && achievements.length > 0 && (
          <p className="border border-dashed border-hair p-4 text-center font-nav text-xs uppercase tracking-wider text-ink-faint">
            <Link href="/login" className="text-lime hover:underline">
              Connectez-vous
            </Link>{" "}
            pour réclamer vos hauts faits et suivre vos demandes.
          </p>
        )}

        {achievements.length === 0 ? (
          <div className="border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
            Aucun haut fait défini par cette association.
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {achievements.map((a) => {
              const awards = myAwards.filter((aw) => aw.achievementId === a.id);
              const claims = myClaims.filter((c) => c.achievementId === a.id);
              const owned = awards.length > 0;
              const pendingClaim = claims.find((c) => c.status === "PENDING");
              const latestClaim = claims[0];
              const rejectedClaim =
                !pendingClaim && latestClaim?.status === "REJECTED" ? latestClaim : null;
              const canClaim =
                !!userId && !a.isAuto && !pendingClaim && !rejectedClaim && (!owned || a.repeatable);

              const threadMessages: ClaimThreadMessage[] = (rejectedClaim?.messages ?? []).map(
                (m) => ({
                  id: m.id,
                  fromAdmin: m.fromAdmin,
                  body: m.body,
                  authorName: `${m.author.firstName} ${m.author.lastName}`.trim(),
                  createdAt: dateTimeFmt.format(m.createdAt),
                })
              );

              return (
                <li key={a.id}>
                  <article className="panel relative flex flex-col gap-3 overflow-hidden p-4">
                    <span
                      className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg]"
                      style={{ background: color }}
                    />

                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <div
                        className="grid h-14 w-14 shrink-0 place-items-center border"
                        style={{ borderColor: color, background: "#12101A" }}
                      >
                        {a.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.iconUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-xl font-bold" style={{ color }}>
                            {monogram(a.name)}
                          </span>
                        )}
                      </div>

                      {/* Nom + description */}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-lg font-bold uppercase leading-tight text-white">
                          {a.name}
                        </h2>
                        {a.description && (
                          <p className="mt-0.5 font-body text-xs text-ink-soft">{a.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {a.repeatable && (
                            <span className="badge border-violet/50 bg-violet/10 text-violet-bright">
                              Cumulable
                            </span>
                          )}
                          {a.isAuto && (
                            <span className="badge border-gold/50 bg-gold/10 text-gold">
                              Automatique
                            </span>
                          )}
                          {/* Statut personnel du visiteur connecté */}
                          {userId && owned && (
                            <span className="badge badge-ok">
                              Obtenu{a.repeatable && awards.length > 1 ? ` ×${awards.length}` : ""} ·{" "}
                              {dateFmt.format(awards[0].awardedAt)}
                            </span>
                          )}
                          {userId && pendingClaim && (
                            <span className="badge badge-wait">Réclamation en attente</span>
                          )}
                          {userId && rejectedClaim && (
                            <span className="badge badge-no">Réclamation refusée</span>
                          )}
                          {userId && canClaim && <ClaimButton achievementId={a.id} again={owned} />}
                        </div>
                      </div>

                      {/* Valeur en renom */}
                      <div className="shrink-0 text-right">
                        <span className="font-display text-3xl font-bold leading-none text-lime">
                          {a.points}
                        </span>
                        <span className="stat-label block">Renom</span>
                      </div>
                    </div>

                    {userId && rejectedClaim && (
                      <div className="border-t border-hair pt-3">
                        <ClaimThread
                          claimId={rejectedClaim.id}
                          messages={threadMessages}
                          canReply
                        />
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        {/* Pagination — 10 hauts faits par page */}
        {pageCount > 1 && (
          <nav className="flex items-center justify-between" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={`/associations/${association.id}/hauts-faits?page=${page - 1}`}
                className="btn btn-ghost px-4 py-2"
              >
                ← Précédent
              </Link>
            ) : (
              <span className="btn btn-ghost px-4 py-2 opacity-40">← Précédent</span>
            )}
            <span className="font-nav text-xs uppercase tracking-wider text-ink-faint">
              Page {page} / {pageCount} · {total} haut{total > 1 ? "s" : ""} fait{total > 1 ? "s" : ""}
            </span>
            {page < pageCount ? (
              <Link
                href={`/associations/${association.id}/hauts-faits?page=${page + 1}`}
                className="btn btn-ghost px-4 py-2"
              >
                Suivant →
              </Link>
            ) : (
              <span className="btn btn-ghost px-4 py-2 opacity-40">Suivant →</span>
            )}
          </nav>
        )}

        <Link
          href={`/associations/${association.id}`}
          className="inline-block font-nav text-xs uppercase tracking-wider text-lime hover:underline"
        >
          ← Retour à l'association
        </Link>
      </div>
    </main>
  );
}
