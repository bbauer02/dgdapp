"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAchievementAction,
  updateAchievementAction,
  deleteAchievementAction,
} from "@/lib/actions/achievements";
import BadgeImageField from "@/components/ui/BadgeImageField";

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export interface EditableAchievement {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  points: number;
  repeatable: boolean;
  isAuto: boolean;
}

type FormState = { error?: string; done?: boolean } | undefined;

/**
 * Formulaire de création / édition d'un haut fait (RF-21).
 * Mode création quand `achievement` est absent.
 */
export default function AchievementForm({
  associationId,
  achievement,
}: {
  associationId: string;
  achievement?: EditableAchievement;
}) {
  const router = useRouter();
  const isEdit = !!achievement;

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const input = {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        iconUrl: String(formData.get("iconUrl") ?? ""),
        points: Number(formData.get("points") ?? 0),
        repeatable: formData.get("repeatable") === "on",
      };
      const res = achievement
        ? await updateAchievementAction(achievement.id, input)
        : await createAchievementAction(associationId, input);
      if (!res.ok) return { error: res.error };
      router.refresh();
      return { done: true };
    },
    undefined
  );

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const remove = () => {
    if (!achievement) return;
    if (!window.confirm(`Supprimer le haut fait « ${achievement.name} » ? Les attributions existantes seront perdues.`)) {
      return;
    }
    startDelete(async () => {
      setDeleteError(null);
      const res = await deleteAchievementAction(achievement.id);
      if (!res.ok) setDeleteError(res.error);
      else router.refresh();
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Nom</span>
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={achievement?.name ?? ""}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={achievement?.description ?? ""}
          className={inputCls}
        />
      </label>

      <BadgeImageField
        name="iconUrl"
        label="Icône du badge"
        defaultValue={achievement?.iconUrl}
      />

      <label className="flex flex-col gap-1">
        <span className="stat-label">Valeur (points de renom)</span>
        <input
          name="points"
          type="number"
          min={0}
          max={100000}
          step={1}
          required
          defaultValue={achievement?.points ?? 0}
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          name="repeatable"
          type="checkbox"
          defaultChecked={achievement?.repeatable ?? false}
          className="h-4 w-4 accent-[#A3FF12]"
        />
        <span className="font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Cumulable (peut être obtenu plusieurs fois)
        </span>
      </label>

      {state?.error && <p className="badge badge-no justify-center py-1.5">{state.error}</p>}
      {deleteError && <p className="badge badge-no justify-center py-1.5">{deleteError}</p>}
      {state?.done && !isEdit && (
        <p className="badge badge-ok justify-center py-1.5">Haut fait créé.</p>
      )}
      {state?.done && isEdit && (
        <p className="badge badge-ok justify-center py-1.5">Modifications enregistrées.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary px-5 py-2 disabled:opacity-60">
          {pending ? "…" : isEdit ? "Enregistrer" : "Créer le haut fait"}
        </button>
        {isEdit && !achievement.isAuto && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="btn btn-ghost px-5 py-2 text-danger hover:border-danger disabled:opacity-60"
          >
            {deleting ? "…" : "Supprimer"}
          </button>
        )}
        {isEdit && achievement.isAuto && (
          <span className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
            Badge système — suppression impossible
          </span>
        )}
      </div>
    </form>
  );
}
