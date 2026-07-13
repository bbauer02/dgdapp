"use client";

import { useActionState } from "react";
import {
  joinAssociationAction,
  leaveAssociationAction,
  type AssoFormState,
} from "@/lib/actions/associations";

/**
 * Rejoindre / Quitter une association (RF-10, RG-02).
 * `status` = statut du visiteur vis-à-vis de l'association.
 */
export default function MembershipActions({
  associationId,
  status,
}: {
  associationId: string;
  status: "NONE" | "PENDING" | "ACTIVE";
}) {
  const [joinState, joinAction, joinPending] = useActionState<AssoFormState, FormData>(
    joinAssociationAction.bind(null, associationId),
    undefined
  );
  const [leaveState, leaveAction, leavePending] = useActionState<AssoFormState, FormData>(
    leaveAssociationAction.bind(null, associationId),
    undefined
  );

  const error = joinState?.error ?? leaveState?.error;
  const success = joinState?.success ?? leaveState?.success;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "NONE" && (
          <form action={joinAction}>
            <button type="submit" disabled={joinPending} className="btn btn-lime disabled:opacity-60">
              {joinPending ? "…" : "Rejoindre"}
            </button>
          </form>
        )}

        {status === "PENDING" && <span className="badge badge-wait">Demande en attente</span>}

        {status === "ACTIVE" && (
          <>
            <span className="badge badge-ok">Membre</span>
            <form action={leaveAction}>
              <button
                type="submit"
                disabled={leavePending}
                className="font-nav text-xs uppercase tracking-wider text-ink-faint transition hover:text-danger"
              >
                {leavePending ? "…" : "Quitter l'association"}
              </button>
            </form>
          </>
        )}
      </div>

      {error && <p className="badge badge-no max-w-md py-2">{error}</p>}
      {success && !error && <p className="badge badge-ok max-w-md py-2">{success}</p>}
    </div>
  );
}
