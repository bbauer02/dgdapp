"use client";

import { useActionState } from "react";
import { replyToClaimAction } from "@/lib/actions/achievements";

export interface ClaimThreadMessage {
  id: string;
  fromAdmin: boolean;
  body: string;
  authorName: string;
  createdAt: string; // pré-formatée côté serveur (sérialisable)
}

type ReplyState = { error?: string } | undefined;

/**
 * Fil de messages d'une réclamation (RF-25) — motifs de refus côté admin,
 * réponses du réclamant. La réponse repasse la réclamation en PENDING.
 */
export default function ClaimThread({
  claimId,
  messages,
  canReply,
}: {
  claimId: string;
  messages: ClaimThreadMessage[];
  /** Le visiteur est l'auteur de la réclamation et peut répondre. */
  canReply: boolean;
}) {
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(
    async (_prev, formData) => {
      const res = await replyToClaimAction(claimId, String(formData.get("body") ?? ""));
      return res.ok ? undefined : { error: res.error };
    },
    undefined
  );

  return (
    <div className="flex flex-col gap-3">
      {messages.length > 0 && (
        <ol className="flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`border p-3 ${
                m.fromAdmin
                  ? "border-danger/30 bg-danger/5"
                  : "border-hair bg-surface-raised"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span
                  className={`font-nav text-[0.65rem] font-bold uppercase tracking-wider ${
                    m.fromAdmin ? "text-danger" : "text-lime"
                  }`}
                >
                  {m.fromAdmin ? "Administration" : m.authorName}
                </span>
                <span className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
                  {m.createdAt}
                </span>
              </div>
              <p className="font-body text-sm text-ink">{m.body}</p>
            </li>
          ))}
        </ol>
      )}

      {canReply && (
        <form action={formAction} className="flex flex-col gap-2">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Votre réponse — elle rouvrira la réclamation."
            className="rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet"
          />
          {state?.error && (
            <p className="badge badge-no justify-center py-1.5">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-ghost self-start px-4 py-2 disabled:opacity-60"
          >
            {pending ? "…" : "Répondre"}
          </button>
        </form>
      )}
    </div>
  );
}
