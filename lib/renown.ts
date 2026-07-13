// ---------------------------------------------------------------------------
// Valeur d'un joueur (CV gamifié) = points de palmarès libre (MemberFeat)
//   + Renom des hauts faits obtenus (chaque AchievementAward compte la valeur
//   du badge — un badge cumulable rapporte donc à chaque attribution).
// ---------------------------------------------------------------------------

type FeatPoints = { points: number };
type AwardPoints = { achievement: { points: number } };

/** Sélections Prisma minimales pour calculer la valeur d'un joueur. */
export const playerValueSelect = {
  feats: { select: { points: true } },
  achievementAwards: { select: { achievement: { select: { points: true } } } },
} as const;

export function playerValue(feats: FeatPoints[], awards: AwardPoints[]): number {
  return (
    feats.reduce((sum, f) => sum + f.points, 0) +
    awards.reduce((sum, a) => sum + a.achievement.points, 0)
  );
}
