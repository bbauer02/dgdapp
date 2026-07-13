import Link from "next/link";
import { notFound } from "next/navigation";
import type { AwardMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/permissions";
import { factionColor } from "@/lib/faction";
import AchievementForm from "@/components/achievements/AchievementForm";
import ClaimReviewCard, { type ReviewableClaim } from "@/components/achievements/ClaimReviewCard";
import GrantAwardForm from "@/components/achievements/GrantAwardForm";
import SectionTabs from "@/components/ui/SectionTabs";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const MODE_LABEL: Record<AwardMode, string> = {
  MANUAL: "Manuel",
  CLAIM: "Réclamation",
  AUTOMATIC: "Automatique",
};
const MODE_BADGE: Record<AwardMode, string> = {
  MANUAL: "border-violet/50 bg-violet/10 text-violet-bright",
  CLAIM: "badge-ok",
  AUTOMATIC: "border-gold/50 bg-gold/10 text-gold",
};

/** Monogramme de secours quand le badge n'a pas d'icône. */
function monogram(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

// RF-21/22/25, RG-03/04 — administration des hauts faits d'une association,
// découpée en onglets : Registre / Réclamations / Attribution / Journal.
export default async function ManageAchievements({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireModule(id, "ACHIEVEMENTS", "WRITE");

  const association = await prisma.association.findUnique({
    where: { id },
    select: { id: true, name: true, nameNormalized: true },
  });
  if (!association) notFound();

  const [achievements, pendingClaims, settledClaims, memberships, awards] = await Promise.all([
    prisma.achievement.findMany({
      where: { associationId: id },
      orderBy: [{ points: "desc" }, { name: "asc" }],
      include: { _count: { select: { awards: true } } },
    }),
    prisma.achievementClaim.findMany({
      where: { status: "PENDING", achievement: { associationId: id } },
      orderBy: { createdAt: "asc" },
      include: {
        achievement: { select: { name: true, repeatable: true } },
        user: { select: { firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.achievementClaim.findMany({
      where: { status: { not: "PENDING" }, achievement: { associationId: id } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        achievement: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.associationMember.findMany({
      where: { associationId: id, status: "ACTIVE" },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { user: { lastName: "asc" } },
    }),
    prisma.achievementAward.findMany({
      where: { achievement: { associationId: id } },
      orderBy: { awardedAt: "desc" },
      take: 100,
      include: {
        achievement: { select: { name: true, points: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        grantedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const color = factionColor(association.nameNormalized);

  const reviewableClaims: ReviewableClaim[] = pendingClaims.map((c) => ({
    id: c.id,
    userName: `${c.user.firstName} ${c.user.lastName}`.trim(),
    achievementName: c.achievement.name,
    repeatable: c.achievement.repeatable,
    createdAt: dateFmt.format(c.createdAt),
    messages: c.messages.map((m) => ({
      id: m.id,
      fromAdmin: m.fromAdmin,
      body: m.body,
      authorName: `${m.author.firstName} ${m.author.lastName}`.trim(),
      createdAt: dateTimeFmt.format(m.createdAt),
    })),
  }));

  const grantMembers = memberships.map((m) => ({
    id: m.user.id,
    name: `${m.user.firstName} ${m.user.lastName}`.trim(),
  }));
  const grantAchievements = achievements.map((a) => ({
    id: a.id,
    name: a.name,
    repeatable: a.repeatable,
  }));

  // ------------------------------------------------ RF-21 : registre + CRUD
  const registre = (
    <section className="space-y-4">
      <details className="border border-dashed border-hair">
        <summary className="cursor-pointer select-none p-4 font-nav text-xs font-semibold uppercase tracking-wider text-lime hover:underline">
          ＋ Nouveau haut fait
        </summary>
        <div className="max-w-xl border-t border-hair p-5">
          <AchievementForm associationId={association.id} />
        </div>
      </details>

      {achievements.length === 0 ? (
        <EmptyState>Aucun haut fait — créez le premier ci-dessus.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {achievements.map((a) => (
            <li key={a.id}>
              <article className="panel relative overflow-hidden">
                <span
                  className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg]"
                  style={{ background: color }}
                />

                <div className="flex items-center gap-4 p-4">
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

                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-bold uppercase leading-tight text-white">
                      {a.name}
                    </h3>
                    {a.description && (
                      <p className="mt-0.5 font-body text-xs text-ink-soft">{a.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2">
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
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="font-display text-2xl font-bold leading-none text-lime">
                      {a.points}
                    </span>
                    <span className="stat-label block">Renom</span>
                    <span className="stat-label mt-1 block">
                      ×{a._count.awards} attribué{a._count.awards > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <details className="border-t border-hair">
                  <summary className="cursor-pointer select-none px-4 py-2.5 font-nav text-[0.65rem] font-semibold uppercase tracking-wider text-lime hover:underline">
                    Modifier
                  </summary>
                  <div className="max-w-xl px-4 pb-5 pt-2">
                    <AchievementForm
                      associationId={association.id}
                      achievement={{
                        id: a.id,
                        name: a.name,
                        description: a.description,
                        iconUrl: a.iconUrl,
                        points: a.points,
                        repeatable: a.repeatable,
                        isAuto: a.isAuto,
                      }}
                    />
                  </div>
                </details>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  // ------------------------------------- RF-25 / RG-03 : réclamations
  const reclamations = (
    <section className="space-y-8">
      {reviewableClaims.length === 0 ? (
        <EmptyState>Aucune réclamation à instruire.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviewableClaims.map((c) => (
            <ClaimReviewCard key={c.id} claim={c} />
          ))}
        </div>
      )}

      {settledClaims.length > 0 && (
        <div className="panel p-5">
          <h3 className="stat-label mb-3">Réclamations traitées récemment</h3>
          <ul className="space-y-2">
            {settledClaims.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 border-b border-hair pb-2 last:border-0 last:pb-0"
              >
                <span className="flex-1 font-body text-sm text-ink">
                  <span className="font-semibold text-white">
                    {c.user.firstName} {c.user.lastName}
                  </span>{" "}
                  · {c.achievement.name}
                </span>
                <span className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
                  {dateFmt.format(c.updatedAt)}
                </span>
                <span className={`badge ${c.status === "APPROVED" ? "badge-ok" : "badge-no"}`}>
                  {c.status === "APPROVED" ? "Validée" : "Refusée"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  // --------------------------------------- RF-22 : attribution manuelle
  const attribution = (
    <section className="max-w-xl">
      <p className="mb-4 font-body text-sm text-ink-soft">
        Décernez directement un haut fait à un membre actif — l'attribution est
        journalisée (mode « Manuel »).
      </p>
      <div className="panel p-5">
        <GrantAwardForm members={grantMembers} achievements={grantAchievements} />
      </div>
    </section>
  );

  // ------------------------------------------- RG-04 : journalisation
  const journal = (
    <section>
      {awards.length === 0 ? (
        <EmptyState>Aucune attribution pour l'instant.</EmptyState>
      ) : (
        <ol className="space-y-2">
          {awards.map((aw) => (
            <li key={aw.id} className="panel flex flex-wrap items-center gap-3 p-4">
              <span className="w-28 shrink-0 font-nav text-xs uppercase tracking-wider text-ink-faint">
                {dateFmt.format(aw.awardedAt)}
              </span>
              <Link
                href={`/players/${aw.user.id}`}
                className="font-display text-lg font-bold uppercase text-white hover:text-lime"
              >
                {aw.user.firstName} {aw.user.lastName}
              </Link>
              <span className="flex-1 font-body text-sm text-ink-soft">
                {aw.achievement.name}
                {aw.grantedBy && (
                  <>
                    {" "}
                    — par {aw.grantedBy.firstName} {aw.grantedBy.lastName}
                  </>
                )}
              </span>
              <span className="font-display font-bold text-lime">+{aw.achievement.points}</span>
              <span className={`badge ${MODE_BADGE[aw.mode]}`}>{MODE_LABEL[aw.mode]}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

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
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="kicker flex items-center gap-3">
            <span className="slash" aria-hidden />
            <Link href={`/associations/${association.id}`} className="hover:underline">
              {association.name}
            </Link>
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold leading-none md:text-6xl" style={{ color }}>
            Gérer les hauts faits
          </h1>
          <Link
            href={`/associations/${association.id}/hauts-faits`}
            className="mt-5 inline-block font-nav text-xs uppercase tracking-wider text-lime hover:underline"
          >
            ← Vue publique des hauts faits
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SectionTabs
          color={color}
          tabs={[
            { key: "registre", label: "Registre", count: achievements.length, content: registre },
            {
              key: "reclamations",
              label: "Réclamations",
              count: pendingClaims.length,
              urgent: true,
              content: reclamations,
            },
            { key: "attribution", label: "Attribution manuelle", content: attribution },
            { key: "journal", label: "Journal", count: awards.length, content: journal },
          ]}
        />
      </div>
    </main>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-hair p-8 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
      {children}
    </div>
  );
}
