import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderUser } from "@/components/site/SiteHeader";
import { factionColor, initials } from "@/lib/faction";
import { playerValue } from "@/lib/renown";
import { RoleBadge } from "@/components/roles/Role";
import ProfileCarousel from "@/components/players/ProfileCarousel";

const yearFmt = new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short" });

const FEAT_LABEL: Record<string, string> = {
  EVENT: "Événement",
  TRAINING: "Formation",
  DISTINCTION: "Distinction",
  OTHER: "Autre",
};
const FEAT_BADGE: Record<string, string> = {
  EVENT: "badge-ok",
  TRAINING: "border-faction-3/50 text-faction-3 bg-faction-3/10",
  DISTINCTION: "badge-wait",
  OTHER: "border-hair text-ink-soft",
};

// Mode d'obtention d'un haut fait (RG-04 — journalisation visible).
const AWARD_MODE_LABEL: Record<string, string> = {
  MANUAL: "Manuel",
  CLAIM: "Réclamation",
  AUTOMATIC: "Automatique",
};
const AWARD_MODE_BADGE: Record<string, string> = {
  MANUAL: "border-violet/50 bg-violet/10 text-violet-bright",
  CLAIM: "badge-ok",
  AUTOMATIC: "border-gold/50 bg-gold/10 text-gold",
};

/** Monogramme de secours pour un badge sans icône. */
function badgeMonogram(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function ageFrom(birth: Date | null): string {
  if (!birth) return "—";
  const diff = Date.now() - birth.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

export default async function PlayerProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const headerUser: HeaderUser | null = session
    ? { id: session.user.id, name: session.user.name ?? "Profil", role: session.user.role }
    : null;

  const { id } = await params;
  const p = await prisma.user.findUnique({
    where: { id },
    include: {
      association: true,
      campGear: { orderBy: { createdAt: "asc" } },
      registrations: { include: { event: true }, orderBy: { createdAt: "desc" } },
      feats: { orderBy: [{ year: "desc" }, { createdAt: "desc" }] },
      achievementAwards: {
        orderBy: { awardedAt: "desc" },
        include: {
          achievement: { include: { association: { select: { name: true } } } },
        },
      },
    },
  });
  if (!p) notFound();

  const canEdit =
    !!session &&
    (session.user.id === p.id || session.user.role === "ADMIN");

  const color = factionColor(p.association?.nameNormalized ?? p.id);
  // Valeur = palmarès libre + Renom des hauts faits obtenus.
  const value = playerValue(p.feats, p.achievementAwards);
  const renown = p.achievementAwards.reduce((sum, aw) => sum + aw.achievement.points, 0);
  const stats = [
    { label: "Valeur", value: `${value}`, accent: true },
    { label: "Âge", value: `${ageFrom(p.birthDate)}` },
    { label: "Membre depuis", value: yearFmt.format(p.createdAt) },
    { label: "Association", value: p.association?.name ?? "—" },
    { label: "Matériel", value: `${p.campGear.length} tente(s)` },
    { label: "Événements", value: `${p.registrations.length}` },
  ];

  // Hauts faits (RF-23/RG-04) : attributions groupées par badge, ×N pour les
  // cumulables, avec l'association émettrice et le(s) mode(s) d'obtention.
  const badgeGroups: Array<{
    achievement: (typeof p.achievementAwards)[number]["achievement"];
    count: number;
    latest: Date;
    modes: string[];
  }> = [];
  for (const aw of p.achievementAwards) {
    const group = badgeGroups.find((g) => g.achievement.id === aw.achievementId);
    if (group) {
      group.count += 1;
      if (!group.modes.includes(aw.mode)) group.modes.push(aw.mode);
    } else {
      badgeGroups.push({
        achievement: aw.achievement,
        count: 1,
        latest: aw.awardedAt, // trié desc → la première occurrence est la plus récente
        modes: [aw.mode],
      });
    }
  }

  // Sections fed to the vertical carousel (team-carousel style): one visible at
  // a time, switched from the side rail.
  const sections = [
    {
      key: "palmares",
      label: "Palmarès",
      content: (
        <section>
          <div className="flex items-baseline justify-between">
            <SectionTitle color={color}>Palmarès & haut faits</SectionTitle>
            <span className="font-nav text-xs uppercase tracking-wider text-ink-soft">
              Valeur totale <span className="font-display text-lg font-bold text-lime">{value}</span>
            </span>
          </div>
          {p.feats.length === 0 ? (
            <EmptyState>Aucun haut fait — un novice qui n'a pas encore fait ses preuves.</EmptyState>
          ) : (
            <ol className="mt-5 space-y-2">
              {p.feats.map((f) => (
                <li key={f.id} className="panel flex items-center gap-4 p-4">
                  <span className="w-14 shrink-0 font-display text-xl font-bold text-ink-faint">
                    {f.year ?? "—"}
                  </span>
                  <span className="hidden w-28 shrink-0 sm:block">
                    <span className={`badge ${FEAT_BADGE[f.category]}`}>{FEAT_LABEL[f.category]}</span>
                  </span>
                  <span className="flex-1 font-display text-lg font-bold uppercase text-white">
                    {f.title}
                  </span>
                  <span className="font-display text-lg font-bold text-lime">+{f.points}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ),
    },
    {
      key: "hauts-faits",
      label: "Hauts faits",
      content: (
        <section>
          <div className="flex items-baseline justify-between">
            <SectionTitle color={color}>Hauts faits</SectionTitle>
            <span className="font-nav text-xs uppercase tracking-wider text-ink-soft">
              Renom <span className="font-display text-lg font-bold text-lime">{renown}</span>
            </span>
          </div>
          {badgeGroups.length === 0 ? (
            <EmptyState>Aucun haut fait décerné par une association.</EmptyState>
          ) : (
            <ol className="mt-5 flex flex-col gap-3">
              {badgeGroups.map((g) => (
                <li key={g.achievement.id}>
                  <article className="panel relative flex items-center gap-4 overflow-hidden p-4">
                    <span
                      className="absolute right-0 top-0 h-full w-1 -skew-x-[20deg]"
                      style={{ background: color }}
                    />

                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center border"
                      style={{ borderColor: color, background: "#12101A" }}
                    >
                      {g.achievement.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.achievement.iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-xl font-bold" style={{ color }}>
                          {badgeMonogram(g.achievement.name)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold uppercase leading-tight text-white">
                        {g.achievement.name}
                        {g.count > 1 && <span className="text-lime"> ×{g.count}</span>}
                      </h3>
                      {g.achievement.description && (
                        <p className="mt-0.5 font-body text-xs text-ink-soft">
                          {g.achievement.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="stat-label">
                          {g.achievement.association.name} · {yearFmt.format(g.latest)}
                        </span>
                        {g.modes.map((m) => (
                          <span key={m} className={`badge ${AWARD_MODE_BADGE[m]}`}>
                            {AWARD_MODE_LABEL[m]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-display text-2xl font-bold leading-none text-lime">
                        +{g.achievement.points * g.count}
                      </span>
                      <span className="stat-label block">Renom</span>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      ),
    },
    {
      key: "costumes-civil",
      label: "Costumes civils",
      content: <Gallery title="Costumes civils" pics={p.civilianCostumePics} color={color} />,
    },
    {
      key: "costumes-militaire",
      label: "Costumes militaires",
      content: <Gallery title="Costumes militaires" pics={p.militaryCostumePics} color={color} />,
    },
    {
      key: "materiel",
      label: "Matériel de camp",
      content: (
        <section>
          <SectionTitle color={color}>Matériel de camp</SectionTitle>
          {p.campGear.length === 0 ? (
            <EmptyState>Aucun matériel déclaré.</EmptyState>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {p.campGear.map((g) => (
                <div key={g.id} className="panel relative overflow-hidden p-4">
                  <span className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg]" style={{ background: g.color ?? color }} />
                  <div className="stat-label">{g.tentType} · {g.shape}</div>
                  <div className="mt-1 font-display text-xl font-bold uppercase text-white">{g.label}</div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-nav text-sm text-ink-soft">
                    <span>
                      {g.shape === "ROUND"
                        ? `Ø ${g.diameterM ?? "—"} m`
                        : `${g.widthM ?? "—"} × ${g.lengthM ?? "—"} m`}
                    </span>
                    {g.footprintAreaM2 && <span>{String(g.footprintAreaM2)} m²</span>}
                    <span>cordage {String(g.ropeZoneRadiusM)} m</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ),
    },
    {
      key: "events",
      label: "Événements",
      content: (
        <section>
          <SectionTitle color={color}>Événements</SectionTitle>
          {p.registrations.length === 0 ? (
            <EmptyState>Aucune inscription.</EmptyState>
          ) : (
            <ul className="mt-5 space-y-2">
              {p.registrations.map((r) => (
                <li key={r.id} className="panel flex flex-wrap items-center gap-3 p-4">
                  <span className="flex-1 font-display text-lg font-bold uppercase text-white">
                    {r.event.title}
                  </span>
                  <RoleBadge role={r.role} />
                  <span
                    className={`badge ${
                      r.status === "APPROVED"
                        ? "badge-ok"
                        : r.status === "REJECTED"
                          ? "badge-no"
                          : "badge-wait"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ),
    },
  ];

  return (
    <main className="min-h-screen">
      <SiteHeader user={headerUser} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hex">
        {/* Right-side avatar + slashes */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
          <div className="absolute right-24 top-0 h-full w-16 -skew-x-[20deg]" style={{ background: color, opacity: 0.85 }} />
          <div className="absolute right-56 top-0 h-full w-6 -skew-x-[20deg] bg-violet/50" />
        </div>
        <div
          className="absolute right-10 top-1/2 hidden h-56 w-56 -translate-y-1/2 place-items-center md:grid"
          style={{ background: "#1B1826", border: `2px solid ${color}` }}
        >
          {p.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.profilePicture} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-7xl font-bold" style={{ color }}>
              {initials(p.firstName, p.lastName)}
            </span>
          )}
        </div>

        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="kicker" style={{ color }}>
            {p.association?.name ?? "Combattant libre"}
          </p>
          <h1 className="mt-2 font-display text-6xl font-bold leading-none text-white md:text-8xl">
            {p.firstName} {p.lastName}
          </h1>

          {canEdit && (
            <Link href={`/players/${p.id}/edit`} className="btn btn-primary mt-6 inline-block">
              Éditer le profil
            </Link>
          )}

          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
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

      {/* Vertical section carousel (replaces the old sticky tab bar) */}
      <ProfileCarousel sections={sections} color={color} />

      <div className="mx-auto max-w-7xl px-6 pb-16">
        <Link href="/players" className="inline-block font-nav text-xs uppercase tracking-wider text-lime hover:underline">
          ← Tous les participants
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

function Gallery({
  title,
  pics,
  color,
}: {
  title: string;
  pics: string[];
  color: string;
}) {
  return (
    <section>
      <SectionTitle color={color}>{title}</SectionTitle>
      {pics.length === 0 ? (
        <EmptyState>Aucune photo — en attente de dépôt/validation.</EmptyState>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pics.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="aspect-[3/4] w-full border border-hair object-cover" />
          ))}
        </div>
      )}
    </section>
  );
}
