"use client";

import { useState, useTransition } from "react";
import { claimAchievementAction } from "@/lib/actions/achievements";

/** Bouton "Réclamer" d'un haut fait (RF-24). */
export default function ClaimButton({
  achievementId,
  again = false,
}: {
  achievementId: string;
  /** Le badge est cumulable et déjà obtenu — on peut le re-réclamer. */
  again?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const claim = () =>
    startTransition(async () => {
      setError(null);
      const res = await claimAchievementAction(achievementId);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={claim}
        disabled={pending}
        className="btn btn-lime px-4 py-2 disabled:opacity-60"
      >
        {pending ? "…" : again ? "Réclamer à nouveau" : "Réclamer"}
      </button>
      {error && <p className="badge badge-no justify-center py-1.5">{error}</p>}
    </div>
  );
}
