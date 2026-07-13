"use client";

import { useActionState } from "react";
import { grantAchievementAction } from "@/lib/actions/achievements";

const selectCls =
  "rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

type GrantState = { error?: string; done?: boolean } | undefined;

/** Attribution manuelle d'un haut fait à un membre ACTIF (RF-22). */
export default function GrantAwardForm({
  members,
  achievements,
}: {
  members: Array<{ id: string; name: string }>;
  achievements: Array<{ id: string; name: string; repeatable: boolean }>;
}) {
  const [state, formAction, pending] = useActionState<GrantState, FormData>(
    async (_prev, formData) => {
      const achievementId = String(formData.get("achievementId") ?? "");
      const userId = String(formData.get("userId") ?? "");
      if (!achievementId || !userId) return { error: "Choisissez un membre et un haut fait." };
      const res = await grantAchievementAction(achievementId, userId);
      return res.ok ? { done: true } : { error: res.error };
    },
    undefined
  );

  if (members.length === 0 || achievements.length === 0) {
    return (
      <p className="border border-dashed border-hair p-6 text-center font-nav text-sm uppercase tracking-wider text-ink-faint">
        Il faut au moins un membre actif et un haut fait pour attribuer.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Membre</span>
          <select name="userId" required defaultValue="" className={selectCls}>
            <option value="" disabled>
              — Choisir un membre —
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="stat-label">Haut fait</span>
          <select name="achievementId" required defaultValue="" className={selectCls}>
            <option value="" disabled>
              — Choisir un haut fait —
            </option>
            {achievements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.repeatable ? " (cumulable)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state?.error && <p className="badge badge-no justify-center py-1.5">{state.error}</p>}
      {state?.done && <p className="badge badge-ok justify-center py-1.5">Haut fait attribué.</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start px-5 py-2 disabled:opacity-60"
      >
        {pending ? "…" : "Attribuer"}
      </button>
    </form>
  );
}
