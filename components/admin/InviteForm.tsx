"use client";

import { useActionState } from "react";
import { inviteToEventAction } from "@/lib/actions/invitations";
import type { FormState } from "@/lib/actions/events";

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

export default function InviteForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    inviteToEventAction,
    undefined
  );

  return (
    <form action={action} className="panel flex flex-col gap-3 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex flex-col gap-1">
        <span className="stat-label">Nom prénom (compte existant) ou email</span>
        <div className="flex gap-2">
          <input
            name="query"
            required
            placeholder="« Sophie Laval » ou « invite@exemple.fr »"
            className={`${input} min-w-0 flex-1`}
          />
          <button disabled={pending} className="btn btn-primary shrink-0 disabled:opacity-60">
            {pending ? "…" : "Inviter"}
          </button>
        </div>
      </label>
      {state?.error && <p className="badge badge-no justify-center py-2">{state.error}</p>}
    </form>
  );
}
