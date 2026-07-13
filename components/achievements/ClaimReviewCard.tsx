"use client";

import { useRef, useState, useTransition } from "react";
import { reviewClaimAction } from "@/lib/actions/achievements";
import type { ClaimThreadMessage } from "@/components/achievements/ClaimThread";

export interface ReviewableClaim {
  id: string;
  userName: string;
  achievementName: string;
  repeatable: boolean;
  createdAt: string; // pré-formatée côté serveur
  messages: ClaimThreadMessage[];
}

/**
 * Instruction d'une réclamation en attente (RF-25) : valider, ou refuser avec
 * motif OBLIGATOIRE (RG-03) consigné dans le fil.
 */
export default function ClaimReviewCard({ claim }: { claim: ReviewableClaim }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const decide = (decision: "APPROVED" | "REJECTED") =>
    startTransition(async () => {
      setError(null);
      const reason = reasonRef.current?.value.trim() ?? "";
      if (decision === "REJECTED" && !reason) {
        setError("Un motif de refus est obligatoire (RG-03).");
        return;
      }
      const res = await reviewClaimAction(claim.id, decision, reason || undefined);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold uppercase text-white">
            {claim.achievementName}
          </div>
          <div className="font-nav text-xs uppercase tracking-wider text-ink-soft">
            Réclamé par <span className="text-lime">{claim.userName}</span> · {claim.createdAt}
          </div>
        </div>
        <span className="badge badge-wait">En attente</span>
      </div>

      {claim.messages.length > 0 && (
        <ol className="flex flex-col gap-2">
          {claim.messages.map((m) => (
            <li
              key={m.id}
              className={`border p-3 ${
                m.fromAdmin ? "border-danger/30 bg-danger/5" : "border-hair bg-surface-raised"
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

      <textarea
        ref={reasonRef}
        rows={2}
        placeholder="Motif — obligatoire en cas de refus, optionnel pour une validation."
        className="rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet focus:shadow-neon-violet"
      />

      {error && <p className="badge badge-no justify-center py-1.5">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => decide("APPROVED")}
          disabled={pending}
          className="btn btn-lime px-5 py-2 disabled:opacity-60"
        >
          {pending ? "…" : "Valider"}
        </button>
        <button
          type="button"
          onClick={() => decide("REJECTED")}
          disabled={pending}
          className="btn btn-ghost px-5 py-2 text-danger hover:border-danger disabled:opacity-60"
        >
          {pending ? "…" : "Refuser"}
        </button>
      </div>
    </div>
  );
}
