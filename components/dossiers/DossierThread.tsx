import type { CostumeType, DossierStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Serialized view models (dates are pre-formatted server-side to avoid any
// hydration drift) + shared FR labels for the dossier workflow.
// ---------------------------------------------------------------------------

export type DossierMessageView = {
  id: string;
  fromAdmin: boolean;
  body: string;
  authorName: string;
  createdAtLabel: string;
};

export type DossierView = {
  id: string;
  type: CostumeType;
  status: DossierStatus;
  fileUrls: string[];
  submittedAtLabel: string;
  messages: DossierMessageView[];
};

export const DOSSIER_STATUS_LABEL: Record<DossierStatus, string> = {
  PENDING: "En attente de validation",
  APPROVED: "Validé",
  REJECTED: "Refusé",
};

export const DOSSIER_STATUS_BADGE: Record<DossierStatus, string> = {
  PENDING: "badge-wait",
  APPROVED: "badge-ok",
  REJECTED: "badge-no",
};

export const COSTUME_TYPE_LABEL: Record<CostumeType, string> = {
  CIVIL: "Civil",
  MILITARY: "Militaire",
};

/**
 * Ticket-style timestamped thread (RF-15/16): reviewer messages on the LEFT
 * (danger/violet tint), participant replies on the RIGHT.
 */
export default function DossierThread({ messages }: { messages: DossierMessageView[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[85%] border p-3 ${
            m.fromAdmin
              ? "mr-auto border-danger/40 bg-danger/10"
              : "ml-auto border-lime/30 bg-surface-raised"
          }`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <span
              className={`font-nav text-[0.65rem] font-bold uppercase tracking-wider ${
                m.fromAdmin ? "text-danger" : "text-lime"
              }`}
            >
              {m.fromAdmin ? `Organisation — ${m.authorName}` : m.authorName}
            </span>
            <span className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
              {m.createdAtLabel}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap font-nav text-sm text-ink">{m.body}</p>
        </div>
      ))}
    </div>
  );
}
