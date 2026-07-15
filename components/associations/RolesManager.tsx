"use client";

import { useState, useTransition } from "react";
import type { AppModule, PermissionLevel } from "@prisma/client";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
  type RolePermissionInput,
} from "@/lib/actions/associations";

export type ModuleOption = { value: AppModule; label: string };
export type RoleData = {
  id: string;
  name: string;
  isDefault: boolean;
  permissions: Array<{ module: AppModule; level: PermissionLevel }>;
};

type Matrix = Partial<Record<AppModule, PermissionLevel | null>>;

const LEVELS: Array<{ value: PermissionLevel | null; label: string }> = [
  { value: null, label: "—" },
  { value: "READ", label: "Lecture" },
  { value: "WRITE", label: "Lecture/Écriture" },
];

function toMatrix(role: RoleData | null, modules: ModuleOption[]): Matrix {
  const matrix: Matrix = {};
  for (const m of modules) {
    matrix[m.value] = role?.permissions.find((p) => p.module === m.value)?.level ?? null;
  }
  return matrix;
}

function toInputs(matrix: Matrix, modules: ModuleOption[]): RolePermissionInput[] {
  return modules.map((m) => ({ module: m.value, level: matrix[m.value] ?? null }));
}

/**
 * Gestion des rôles de l'association (RF-07/08) : liste, création, édition
 * de la matrice de droits module × {—, Lecture, Écriture}, suppression des
 * rôles personnalisés. Les rôles par défaut restent modifiables (RF-07).
 */
export default function RolesManager({
  associationId,
  roles,
  modules,
}: {
  associationId: string;
  roles: RoleData[];
  modules: ModuleOption[];
}) {
  // editingId: null = liste, "new" = création, sinon id du rôle édité.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [matrix, setMatrix] = useState<Matrix>({});
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function openEditor(role: RoleData | null) {
    setEditingId(role?.id ?? "new");
    setName(role?.name ?? "");
    setMatrix(toMatrix(role, modules));
    setMessage(null);
  }

  function close() {
    setEditingId(null);
    setMessage(null);
  }

  function save() {
    startTransition(async () => {
      const permissions = toInputs(matrix, modules);
      const res =
        editingId === "new"
          ? await createRoleAction(associationId, name, permissions)
          : await updateRoleAction(editingId!, name, permissions);
      setMessage(res);
      if (res.success) close();
    });
  }

  function remove(roleId: string) {
    startTransition(async () => {
      const res = await deleteRoleAction(roleId);
      setMessage(res);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message?.error && editingId === null && (
        <p className="badge badge-no max-w-xl py-2">{message.error}</p>
      )}
      {message?.success && editingId === null && (
        <p className="badge badge-ok max-w-xl py-2">{message.success}</p>
      )}

      {/* Liste des rôles */}
      {editingId === null && (
        <>
          <ul className="flex flex-col gap-2">
            {roles.map((role) => (
              <li key={role.id} className="panel flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-display font-bold uppercase text-white">
                    {role.name}{" "}
                    {role.isDefault && (
                      <span className="ml-1 font-nav text-[0.6rem] font-semibold uppercase tracking-wider text-ink-faint">
                        · défaut
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-nav text-xs uppercase tracking-wider text-ink-soft">
                    {role.permissions.length === 0
                      ? "Aucun droit"
                      : role.permissions
                          .map(
                            (p) =>
                              `${modules.find((m) => m.value === p.module)?.label ?? p.module} : ${
                                p.level === "WRITE" ? "lecture/écriture" : "lecture"
                              }`
                          )
                          .join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEditor(role)}
                    className="font-nav text-xs uppercase tracking-wider text-lime hover:underline"
                  >
                    Modifier
                  </button>
                  {!role.isDefault && (
                    <button
                      type="button"
                      onClick={() => remove(role.id)}
                      disabled={pending}
                      className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-danger disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => openEditor(null)} className="btn btn-ghost self-start">
            + Nouveau rôle
          </button>
        </>
      )}

      {/* Éditeur (création ou édition) */}
      {editingId !== null && (
        <div className="panel flex flex-col gap-4 p-4">
          <label className="flex max-w-sm flex-col gap-1">
            <span className="stat-label">Nom du rôle</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet"
              placeholder="Quartier-maître"
            />
          </label>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse">
              <thead>
                <tr className="border-b border-hair">
                  <th className="stat-label py-2 pr-4 text-left">Module</th>
                  {LEVELS.map((l) => (
                    <th key={l.label} className="stat-label px-3 py-2 text-center">
                      {l.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.value} className="border-b border-hair/50">
                    <td className="py-2 pr-4 font-nav text-xs font-semibold uppercase tracking-wider text-ink">
                      {m.label}
                    </td>
                    {LEVELS.map((l) => (
                      <td key={l.label} className="px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`perm-${m.value}`}
                          checked={(matrix[m.value] ?? null) === l.value}
                          onChange={() => setMatrix((prev) => ({ ...prev, [m.value]: l.value }))}
                          className="accent-[#7C4DFF]"
                          aria-label={`${m.label} : ${l.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {message?.error && <p className="badge badge-no max-w-xl py-2">{message.error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending || !name.trim()}
              className="btn btn-primary disabled:opacity-60"
            >
              {pending ? "…" : editingId === "new" ? "Créer le rôle" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={close}
              className="font-nav text-xs uppercase tracking-wider text-ink-faint hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
