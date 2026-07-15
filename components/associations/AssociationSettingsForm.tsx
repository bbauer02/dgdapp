"use client";

import { useActionState } from "react";
import {
  updateAssociationAction,
  type AssoFormState,
} from "@/lib/actions/associations";
import ImageUploadField from "@/components/ui/ImageUploadField";
import SocialLinksField, { type SocialLink } from "@/components/admin/SocialLinksField";

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function AssociationSettingsForm({
  associationId,
  defaults,
}: {
  associationId: string;
  defaults: {
    name: string;
    description: string;
    requiresApproval: boolean;
    logoUrl: string | null;
    bannerUrl: string | null;
    socialLinks: SocialLink[];
  };
}) {
  const [state, formAction, pending] = useActionState<AssoFormState, FormData>(
    updateAssociationAction.bind(null, associationId),
    undefined
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Nom de l'association</span>
        <input name="name" required minLength={2} defaultValue={defaults.name} className={inputCls} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaults.description}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <ImageUploadField name="logoUrl" label="Logo" defaultValue={defaults.logoUrl} crop="circle" />
        <ImageUploadField
          name="bannerUrl"
          label="Bannière (bandeau d'en-tête)"
          defaultValue={defaults.bannerUrl}
          aspect="banner"
        />
      </div>

      <SocialLinksField
        name="socialLinks"
        label="Réseaux sociaux de l'association"
        defaultValue={defaults.socialLinks}
      />

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="requiresApproval"
          defaultChecked={defaults.requiresApproval}
          className="h-4 w-4 accent-[#7C4DFF]"
        />
        <span className="font-nav text-xs font-semibold uppercase tracking-wider text-ink">
          Adhésion sur validation (les demandes restent en attente)
        </span>
      </label>

      {state?.error && <p className="badge badge-no max-w-xl py-2">{state.error}</p>}
      {state?.success && !state.error && (
        <p className="badge badge-ok max-w-xl py-2">{state.success}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  );
}
