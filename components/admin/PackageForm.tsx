"use client";

import { useActionState } from "react";
import { addPackage, type FormState } from "@/lib/actions/events";
import MarkdownEditor from "@/components/ui/MarkdownEditor";

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function PackageForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addPackage,
    undefined
  );

  return (
    <form action={action} className="panel flex flex-col gap-3 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Nom de la formule</span>
          <input name="name" required className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Prix (€)</span>
          <input type="number" name="price" min={0} step="0.01" required className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="stat-label">Éléments inclus (un par ligne)</span>
        <textarea name="includedItems" rows={3} placeholder={"Repas samedi\nBivouac\nAssurance"} className={input} />
      </label>
      <MarkdownEditor
        name="description"
        label="Description de la formule (markdown)"
        rows={4}
      />
      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
      <div>
        <button disabled={pending} className="btn btn-lime disabled:opacity-60">
          {pending ? "…" : "+ Ajouter la formule"}
        </button>
      </div>
    </form>
  );
}
