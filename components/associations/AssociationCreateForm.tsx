"use client";

import { useActionState } from "react";
import {
  createAssociationAction,
  type AssoFormState,
} from "@/lib/actions/associations";

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function AssociationCreateForm() {
  const [state, formAction, pending] = useActionState<AssoFormState, FormData>(
    createAssociationAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Nom de l'association</span>
        <input
          name="name"
          required
          minLength={2}
          className={inputCls}
          placeholder="Compagnie du Griffon Noir"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Description</span>
        <textarea
          name="description"
          rows={4}
          className={inputCls}
          placeholder="Présentation de votre compagnie…"
        />
      </label>

      {state?.error && (
        <p className="badge badge-no w-full justify-center py-2">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary mt-1 disabled:opacity-60">
        {pending ? "…" : "Fonder l'association"}
      </button>

      <p className="font-nav text-xs uppercase tracking-wider text-ink-faint">
        Vous en deviendrez le Président (tous les droits, RG-02).
      </p>
    </form>
  );
}
