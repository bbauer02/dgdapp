"use client";

import { useActionState } from "react";
import {
  reviewDossierFormAction,
  type DossierFormState,
} from "@/lib/actions/dossiers";
import DossierThread, {
  COSTUME_TYPE_LABEL,
  DOSSIER_STATUS_BADGE,
  DOSSIER_STATUS_LABEL,
  type DossierView,
} from "@/components/dossiers/DossierThread";
import { FilePiece } from "@/components/ui/FileDropField";

const inputCls =
  "rounded-none border border-hair bg-base px-3 py-2 font-nav text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

/**
 * Admin side of the costume dossier (RF-15, RG-03): pieces preview, message
 * thread, and a single review form with two submit buttons — the refusal
 * reason is enforced server-side (mandatory, RG-03).
 */
export default function DossierReviewCard({ dossier }: { dossier: DossierView | null }) {
  if (!dossier) {
    return (
      <div className="border border-dashed border-hair px-4 py-3 font-nav text-xs uppercase tracking-wider text-ink-faint">
        Dossier costume non soumis.
      </div>
    );
  }
  return <ReviewCard dossier={dossier} />;
}

function ReviewCard({ dossier }: { dossier: DossierView }) {
  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    reviewDossierFormAction.bind(null, dossier.id),
    undefined
  );

  return (
    <div className="border border-hair bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-nav text-xs font-bold uppercase tracking-wider text-white">
          Dossier costume — {COSTUME_TYPE_LABEL[dossier.type]}
        </span>
        <span className={`badge ${DOSSIER_STATUS_BADGE[dossier.status]}`}>
          {DOSSIER_STATUS_LABEL[dossier.status]}
        </span>
        <span className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
          Soumis le {dossier.submittedAtLabel}
        </span>
      </div>

      {dossier.fileUrls.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {dossier.fileUrls.map((url, i) => (
            <FilePiece key={i} url={url} index={i} />
          ))}
        </div>
      ) : (
        <p className="mt-3 font-nav text-xs text-ink-faint">Aucune pièce fournie.</p>
      )}

      {dossier.messages.length > 0 && (
        <div className="mt-4">
          <div className="stat-label">Fil de messages</div>
          <div className="mt-2">
            <DossierThread messages={dossier.messages} />
          </div>
        </div>
      )}

      <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-hair pt-3">
        <label className="flex flex-col gap-1">
          <span className="stat-label">Motif (obligatoire en cas de refus — RG-03)</span>
          <textarea
            name="reason"
            rows={2}
            placeholder="Ex. : la coupe du surcot n'est pas d'époque, merci de fournir une photo de profil…"
            className={inputCls}
          />
        </label>
        {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            name="decision"
            value="APPROVED"
            disabled={pending || dossier.status === "APPROVED"}
            className="rounded-full border border-lime/50 px-3 py-1.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-lime transition hover:bg-lime/10 disabled:opacity-30"
          >
            Valider le dossier
          </button>
          <button
            type="submit"
            name="decision"
            value="REJECTED"
            disabled={pending || dossier.status === "REJECTED"}
            className="rounded-full border border-danger/50 px-3 py-1.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10 disabled:opacity-30"
          >
            Refuser le dossier
          </button>
        </div>
      </form>
    </div>
  );
}
