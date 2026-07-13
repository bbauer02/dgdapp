"use client";

import { useState, useTransition } from "react";
import { setMemberRolesAction } from "@/lib/actions/associations";

export type RoleOption = { id: string; name: string };

/**
 * Édition des rôles d'UN membre — multi-sélection (le cumul des rôles est
 * autorisé, RF-09). Les erreurs RG-02 remontées par l'action sont affichées.
 */
export default function MemberRolesEditor({
  memberId,
  allRoles,
  currentRoleIds,
}: {
  memberId: string;
  allRoles: RoleOption[];
  currentRoleIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(currentRoleIds);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    selected.length !== currentRoleIds.length ||
    selected.some((id) => !currentRoleIds.includes(id));

  function toggle(roleId: string) {
    setMessage(null);
    setSelected((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  }

  function save() {
    startTransition(async () => {
      const res = await setMemberRolesAction(memberId, selected);
      setMessage(res);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {allRoles.map((role) => {
          const active = selected.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggle(role.id)}
              className={`rounded-sm border px-2 py-0.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider transition ${
                active
                  ? "border-violet bg-violet/20 text-white"
                  : "border-hair text-ink-faint hover:border-violet hover:text-ink"
              }`}
            >
              {role.name}
            </button>
          );
        })}
      </div>

      {(dirty || message) && (
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="btn btn-primary px-4 py-1.5 text-[0.65rem] disabled:opacity-60"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
          )}
          {message?.error && <span className="badge badge-no">{message.error}</span>}
          {message?.success && !dirty && (
            <span className="badge badge-ok">{message.success}</span>
          )}
        </div>
      )}
    </div>
  );
}
