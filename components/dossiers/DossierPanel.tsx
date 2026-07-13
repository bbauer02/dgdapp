"use client";

import { useActionState } from "react";
import {
  submitDossierAction,
  replyToDossierAction,
  type DossierFormState,
} from "@/lib/actions/dossiers";
import DossierThread, {
  COSTUME_TYPE_LABEL,
  DOSSIER_STATUS_BADGE,
  DOSSIER_STATUS_LABEL,
  type DossierView,
} from "@/components/dossiers/DossierThread";
import FileDropField, { FilePiece } from "@/components/ui/FileDropField";

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 font-nav text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

/**
 * Participant side of the costume dossier (RF-14..16): submit the pieces,
 * follow the review status, read the ticket thread and reply to a refusal.
 */
export default function DossierPanel({
  registrationId,
  dossier,
}: {
  registrationId: string;
  dossier: DossierView | null;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <span className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg] bg-gold" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase text-white">
          Dossier costume
        </h3>
        {dossier ? (
          <span className={`badge ${DOSSIER_STATUS_BADGE[dossier.status]}`}>
            {DOSSIER_STATUS_LABEL[dossier.status]}
          </span>
        ) : (
          <span className="badge badge-wait">À soumettre</span>
        )}
      </div>

      {dossier === null ? (
        <>
          <p className="mt-3 font-nav text-sm text-ink-soft">
            Cet événement exige la validation de votre costume. Soumettez vos
            pièces (photos) pour examen par l'organisation.
          </p>
          <SubmitForm registrationId={registrationId} />
        </>
      ) : (
        <>
          <div className="mt-3 font-nav text-xs uppercase tracking-wider text-ink-soft">
            Costume {COSTUME_TYPE_LABEL[dossier.type].toLowerCase()} — soumis le{" "}
            {dossier.submittedAtLabel}
          </div>

          {dossier.fileUrls.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {dossier.fileUrls.map((url, i) => (
                <FilePiece key={i} url={url} index={i} />
              ))}
            </div>
          )}

          {dossier.messages.length > 0 && (
            <div className="mt-5">
              <div className="stat-label">Échanges avec l'organisation</div>
              <div className="mt-2">
                <DossierThread messages={dossier.messages} />
              </div>
            </div>
          )}

          {dossier.status === "REJECTED" && <ReplyForm dossierId={dossier.id} />}

          <details className="mt-5 border-t border-hair pt-4">
            <summary className="cursor-pointer font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime">
              Mettre à jour le dossier (nouvelle soumission)
            </summary>
            <SubmitForm
              registrationId={registrationId}
              defaultType={dossier.type}
              defaultUrls={dossier.fileUrls}
            />
          </details>
        </>
      )}
    </div>
  );
}

function SubmitForm({
  registrationId,
  defaultType = "CIVIL",
  defaultUrls = [],
}: {
  registrationId: string;
  defaultType?: "CIVIL" | "MILITARY";
  defaultUrls?: string[];
}) {
  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    submitDossierAction.bind(null, registrationId),
    undefined
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Type de costume</span>
        <select name="type" defaultValue={defaultType} className={inputCls}>
          <option value="CIVIL">Civil</option>
          <option value="MILITARY">Militaire</option>
        </select>
      </label>
      <FileDropField
        name="fileUrls"
        label="Pièces du dossier (photos ou PDF)"
        defaultUrls={defaultUrls}
      />
      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-lime self-start disabled:opacity-60">
        {pending ? "…" : "Soumettre le dossier"}
      </button>
    </form>
  );
}

function ReplyForm({ dossierId }: { dossierId: string }) {
  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    replyToDossierAction.bind(null, dossierId),
    undefined
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-hair pt-4">
      <label className="flex flex-col gap-1">
        <span className="stat-label">Répondre au refus (le dossier repassera en attente)</span>
        <textarea
          name="body"
          rows={3}
          required
          placeholder="Votre réponse à l'organisation…"
          className={inputCls}
        />
      </label>
      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start disabled:opacity-60">
        {pending ? "…" : "Envoyer la réponse"}
      </button>
    </form>
  );
}
