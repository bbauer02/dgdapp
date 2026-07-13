"use client";

import { useActionState } from "react";
import { addCharacterRole, type FormState } from "@/lib/actions/events";

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default function CharacterRoleForm({
  eventId,
  packages,
}: {
  eventId: string;
  packages: Array<{ id: string; name: string; price: number }>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addCharacterRole,
    undefined
  );

  return (
    <form action={action} className="panel flex flex-col gap-3 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Nom du rôle</span>
          <input name="name" required placeholder="Soldat, Chevalier…" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Formule de prix associée</span>
          <select name="packageId" defaultValue="" className={input}>
            <option value="">— Aucune —</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {euro.format(p.price)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="stat-label">Description (optionnelle)</span>
        <input name="description" className={input} />
      </label>
      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
      <div>
        <button disabled={pending} className="btn btn-lime disabled:opacity-60">
          {pending ? "…" : "+ Ajouter le rôle"}
        </button>
      </div>
    </form>
  );
}
