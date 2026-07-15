"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/events";
import LocationPicker, { type GeoPoint } from "@/components/admin/LocationPicker";
import ImageUploadField from "@/components/ui/ImageUploadField";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import SocialLinksField, { type SocialLink } from "@/components/admin/SocialLinksField";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export interface EventDefaults {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  associationId?: string;
  visibility?: "PUBLIC" | "MEMBERS";
  location?: string;
  position?: GeoPoint | null;
  requiresCostume?: boolean;
  maxParticipants?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  socialLinks?: SocialLink[];
}

export interface AssociationOption {
  id: string;
  name: string;
}

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function EventForm({
  action,
  defaults,
  submitLabel,
  associations,
}: {
  action: Action;
  defaults?: EventDefaults;
  submitLabel: string;
  /** RF-11: associations where the user holds Écriture on Événements. */
  associations: AssociationOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Titre</span>
        <input name="title" required defaultValue={defaults?.title} className={input} />
      </label>

      <MarkdownEditor
        name="description"
        label="Description"
        defaultValue={defaults?.description}
        rows={6}
      />

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <ImageUploadField name="logoUrl" label="Logo" defaultValue={defaults?.logoUrl} />
        <ImageUploadField
          name="bannerUrl"
          label="Bannière (bandeau d'en-tête)"
          defaultValue={defaults?.bannerUrl}
          aspect="banner"
        />
      </div>

      <SocialLinksField
        name="socialLinks"
        label="Réseaux sociaux de l'événement"
        defaultValue={defaults?.socialLinks}
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Association organisatrice</span>
          {/* Pre-select the first writable association (RF-11). */}
          <select
            name="associationId"
            required
            defaultValue={defaults?.associationId || associations[0]?.id}
            className={input}
          >
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Visibilité</span>
          <select name="visibility" defaultValue={defaults?.visibility ?? "PUBLIC"} className={input}>
            <option value="PUBLIC">Public</option>
            <option value="MEMBERS">Réservé aux membres</option>
          </select>
        </label>
      </div>

      <LocationPicker
        inputClass={input}
        defaultLocation={defaults?.location}
        defaultPosition={defaults?.position}
      />

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="requiresCostume"
          defaultChecked={defaults?.requiresCostume}
          className="h-4 w-4 accent-violet"
        />
        <span className="stat-label !mb-0">Dossier costume requis pour s'inscrire</span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Début</span>
          <input type="datetime-local" name="startDate" required defaultValue={defaults?.startDate} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Fin</span>
          <input type="datetime-local" name="endDate" required defaultValue={defaults?.endDate} className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="stat-label">Participants max.</span>
        <input type="number" name="maxParticipants" min={0} defaultValue={defaults?.maxParticipants} className={input} />
        <span className="font-nav text-xs text-ink-faint">
          Les tarifs se définissent via les <strong>formules</strong>, après la création de l'événement.
        </span>
      </label>

      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}

      <div>
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
