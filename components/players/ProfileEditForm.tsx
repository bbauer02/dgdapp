"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/profile";
import FileDropField from "@/components/ui/FileDropField";
import ImageUploadField from "@/components/ui/ImageUploadField";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface AssociationOption {
  id: string;
  name: string;
}

export interface ProfileDefaults {
  firstName: string;
  lastName: string;
  birthDate: string;
  profilePicture: string;
  associationId: string;
  civilianCostumePics: string;
  militaryCostumePics: string;
}

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function ProfileEditForm({
  action,
  defaults,
  associations,
  cancelHref,
}: {
  action: Action;
  defaults: ProfileDefaults;
  associations: AssociationOption[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Prénom</span>
          <input name="firstName" required defaultValue={defaults.firstName} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Nom</span>
          <input name="lastName" required defaultValue={defaults.lastName} className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Date de naissance</span>
        <input type="date" name="birthDate" defaultValue={defaults.birthDate} className={input} />
      </label>

      <ImageUploadField
        name="profilePicture"
        label="Photo de profil (avatar)"
        defaultValue={defaults.profilePicture}
        crop="square"
      />

      <label className="flex flex-col gap-1">
        <span className="stat-label">Association</span>
        <select name="associationId" defaultValue={defaults.associationId} className={input}>
          <option value="">Aucune</option>
          {associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="stat-label">…ou créer une nouvelle association</span>
        <input name="newAssociation" placeholder="Nom de la nouvelle association" className={input} />
        <span className="font-nav text-xs text-ink-faint">
          Si renseigné, ce nom prime sur la sélection ci-dessus.
        </span>
      </label>

      <FileDropField
        name="civilianCostumePics"
        label="Costumes civils (photos ou PDF)"
        defaultUrls={defaults.civilianCostumePics.split("\n").filter(Boolean)}
      />

      <FileDropField
        name="militaryCostumePics"
        label="Costumes militaires (photos ou PDF)"
        defaultUrls={defaults.militaryCostumePics.split("\n").filter(Boolean)}
      />

      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "…" : "Enregistrer"}
        </button>
        <a href={cancelHref} className="btn btn-ghost">
          Annuler
        </a>
      </div>
    </form>
  );
}
