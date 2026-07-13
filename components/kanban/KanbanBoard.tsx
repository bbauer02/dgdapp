"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KanbanStatus } from "@prisma/client";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  setTaskArchivedAction,
  type TaskResult,
} from "@/lib/actions/tasks";
import TaskCard from "./TaskCard";
import CardModal from "./CardModal";
import {
  memberInitials,
  memberName,
  type AssignableUser,
  type LabelDto,
  type TaskDto,
} from "./types";

// Colonnes du board (RF-18) — accents Nécromant : violet / gold / lime.
// Classes littérales (pas de template) pour rester détectables par Tailwind.
const COLUMNS: {
  status: KanbanStatus;
  label: string;
  bar: string;
  text: string;
  count: string;
}[] = [
  {
    status: "TODO",
    label: "À faire",
    bar: "bg-violet",
    text: "text-violet-bright",
    count: "border-violet/50 bg-violet/10 text-violet-bright",
  },
  {
    status: "IN_PROGRESS",
    label: "En cours",
    bar: "bg-gold",
    text: "text-gold",
    count: "border-gold/50 bg-gold/10 text-gold",
  },
  {
    status: "DONE",
    label: "Terminé",
    bar: "bg-lime",
    text: "text-lime",
    count: "border-lime/50 bg-lime/10 text-lime",
  },
];

const byPosition = (a: TaskDto, b: TaskDto) => a.position - b.position;

export default function KanbanBoard({
  eventId,
  initialTasks,
  initialLabels,
  assignables,
}: {
  eventId: string;
  initialTasks: TaskDto[];
  initialLabels: LabelDto[];
  assignables: AssignableUser[];
}) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [boardLabels, setBoardLabels] = useState<LabelDto[]>(initialLabels);
  // Après revalidatePath, la page serveur renvoie l'état frais → on resynchronise.
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setBoardLabels(initialLabels), [initialLabels]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    status: KanbanStatus;
    index: number;
  } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Composer inline façon Trello (un par colonne).
  const [composer, setComposer] = useState<KanbanStatus | null>(null);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (composer) composerRef.current?.focus();
  }, [composer]);

  // Filtres (mot-clé / membres / labels) + panneau des archivées.
  const [query, setQuery] = useState("");
  const [filterMembers, setFilterMembers] = useState<Set<string>>(new Set());
  const [filterLabels, setFilterLabels] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const hasFilters = query.trim() !== "" || filterMembers.size > 0 || filterLabels.size > 0;

  function matchesFilters(t: TaskDto): boolean {
    const q = query.trim().toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q))
      return false;
    if (filterMembers.size > 0 && !t.members.some((m) => filterMembers.has(m.id))) return false;
    if (filterLabels.size > 0 && !t.labels.some((l) => filterLabels.has(l.id))) return false;
    return true;
  }

  const archived = useMemo(
    () => tasks.filter((t) => t.archived).sort((a, b) => a.title.localeCompare(b.title, "fr")),
    [tasks]
  );

  const columns = useMemo(() => {
    const map: Record<KanbanStatus, TaskDto[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const t of tasks) {
      if (!t.archived && matchesFilters(t)) map[t.status].push(t);
    }
    for (const key of Object.keys(map) as KanbanStatus[]) map[key].sort(byPosition);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, query, filterMembers, filterLabels]);

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  // --- Application des résultats d'actions -----------------------------------

  function applyTaskResult(res: TaskResult): string | null {
    if ("error" in res) return res.error;
    setTasks((cur) => {
      const exists = cur.some((t) => t.id === res.task.id);
      return exists ? cur.map((t) => (t.id === res.task.id ? res.task : t)) : [...cur, res.task];
    });
    return null;
  }

  function removeTask(taskId: string) {
    setTasks((cur) => cur.filter((t) => t.id !== taskId));
  }

  function labelCreated(label: LabelDto) {
    setBoardLabels((cur) => [...cur, label]);
  }

  function labelUpdated(label: LabelDto) {
    setBoardLabels((cur) => cur.map((l) => (l.id === label.id ? label : l)));
    setTasks((cur) =>
      cur.map((t) => ({
        ...t,
        labels: t.labels.map((l) => (l.id === label.id ? label : l)),
      }))
    );
  }

  function labelDeleted(labelId: string) {
    setBoardLabels((cur) => cur.filter((l) => l.id !== labelId));
    setTasks((cur) =>
      cur.map((t) => ({ ...t, labels: t.labels.filter((l) => l.id !== labelId) }))
    );
    setFilterLabels((cur) => {
      if (!cur.has(labelId)) return cur;
      const next = new Set(cur);
      next.delete(labelId);
      return next;
    });
  }

  // --- Drag & drop natif -------------------------------------------------------

  function resetDrag() {
    setDraggingId(null);
    setDropTarget(null);
  }

  /**
   * Déplacement optimiste : `visualIndex` est l'emplacement visé dans la liste
   * AFFICHÉE (carte déplacée incluse) ; on le convertit en index d'insertion
   * dans la colonne sans la carte — la sémantique de moveTaskAction.
   * NB : avec des filtres actifs l'index visuel ne correspond plus à la
   * position réelle — on dépose alors en fin de colonne.
   */
  async function moveTask(taskId: string, toStatus: KanbanStatus, visualIndex: number) {
    const prev = tasks;
    const moved = prev.find((t) => t.id === taskId);
    if (!moved) return;

    const destVisual = columns[toStatus];
    const curIdx = destVisual.findIndex((t) => t.id === taskId);
    let insertAt = hasFilters
      ? prev.filter((t) => t.status === toStatus && !t.archived && t.id !== taskId).length
      : Math.min(visualIndex, destVisual.length);
    if (!hasFilters && curIdx !== -1 && curIdx < insertAt) insertAt -= 1;
    if (!hasFilters && moved.status === toStatus && insertAt === curIdx) return; // no-op

    // État optimiste : recalcule les positions des colonnes touchées.
    const fromStatus = moved.status;
    const next = prev.map((t) => ({ ...t }));
    const nextMoved = next.find((t) => t.id === taskId)!;
    nextMoved.status = toStatus;
    const dest = next
      .filter((t) => t.status === toStatus && !t.archived && t.id !== taskId)
      .sort(byPosition);
    dest.splice(Math.min(insertAt, dest.length), 0, nextMoved);
    dest.forEach((t, i) => (t.position = i));
    if (fromStatus !== toStatus) {
      next
        .filter((t) => t.status === fromStatus && !t.archived)
        .sort(byPosition)
        .forEach((t, i) => (t.position = i));
    }
    setTasks(next);
    setError(null);

    try {
      const res = await moveTaskAction(taskId, toStatus, insertAt);
      if ("error" in res) {
        setTasks(prev);
        setError(res.error);
      }
    } catch {
      setTasks(prev);
      setError("Échec du déplacement");
    }
  }

  function handleDrop(e: React.DragEvent, status: KanbanStatus) {
    e.preventDefault();
    const taskId = draggingId ?? e.dataTransfer.getData("text/plain");
    const index = dropTarget?.status === status ? dropTarget.index : columns[status].length;
    resetDrag();
    if (taskId) void moveTask(taskId, status, index);
  }

  // --- Composer inline -----------------------------------------------------------

  async function submitComposer(status: KanbanStatus) {
    const title = composerText.trim();
    if (!title) return;
    setComposerText("");
    try {
      const res = await createTaskAction(eventId, { title, status });
      const err = applyTaskResult(res);
      if (err) setError(err);
    } catch {
      setError("Échec de la création");
    }
  }

  // --- Rendu ----------------------------------------------------------------------

  return (
    <div>
      {error && (
        <div className="badge badge-no mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Barre d'outils : filtres + archivées */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer les cartes…"
          className="w-56 rounded-none border border-hair bg-base px-3 py-1.5 text-sm text-ink outline-none transition focus:border-violet"
        />

        {assignables.length > 0 && (
          <div className="flex items-center -space-x-1">
            {assignables.slice(0, 8).map((u) => {
              const on = filterMembers.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  title={memberName(u)}
                  onClick={() =>
                    setFilterMembers((cur) => {
                      const next = new Set(cur);
                      if (on) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    })
                  }
                  className={`flex h-7 w-7 items-center justify-center rounded-full border font-nav text-[0.6rem] font-bold transition ${
                    on
                      ? "z-10 border-lime bg-lime/20 text-lime"
                      : "border-hair bg-surface text-ink-soft hover:border-violet"
                  }`}
                >
                  {u.profilePicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.profilePicture}
                      alt={memberName(u)}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    memberInitials(u)
                  )}
                </button>
              );
            })}
          </div>
        )}

        {boardLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {boardLabels.map((l) => {
              const on = filterLabels.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  title={l.name}
                  onClick={() =>
                    setFilterLabels((cur) => {
                      const next = new Set(cur);
                      if (on) next.delete(l.id);
                      else next.add(l.id);
                      return next;
                    })
                  }
                  className={`h-5 min-w-[2.5rem] rounded-full px-2 font-nav text-[0.6rem] font-bold uppercase text-base transition ${
                    on ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: l.color }}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilterMembers(new Set());
              setFilterLabels(new Set());
            }}
            className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-white"
          >
            Effacer les filtres
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`ml-auto btn btn-ghost !px-4 !py-1.5 ${showArchived ? "!border-violet !text-white" : ""}`}
        >
          🗄 Archivées · {archived.length}
        </button>
      </div>

      {/* Panneau des cartes archivées (menu "Éléments archivés" de Trello) */}
      {showArchived && (
        <div className="panel mb-4 p-3">
          <div className="stat-label mb-2">Cartes archivées</div>
          {archived.length === 0 ? (
            <p className="font-nav text-xs text-ink-faint">Aucune carte archivée.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {archived.map((t) => (
                <li key={t.id} className="flex items-center gap-2 border border-hair bg-base/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenTaskId(t.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm text-ink transition hover:text-white"
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await setTaskArchivedAction(t.id, false);
                      const err = applyTaskResult(res);
                      if (err) setError(err);
                    }}
                    className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-soft transition hover:text-lime"
                  >
                    Renvoyer au tableau
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await deleteTaskAction(t.id);
                      if ("error" in res) setError(res.error);
                      else removeTask(t.id);
                    }}
                    className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = columns[col.status];
          const isTarget = dropTarget?.status === col.status;
          return (
            <section
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget({ status: col.status, index: colTasks.length });
              }}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`flex min-h-[16rem] flex-col border border-hair bg-surface/60 transition ${
                isTarget && draggingId ? "border-violet/60" : ""
              }`}
            >
              <header className="flex items-center gap-3 border-b border-hair px-4 py-3">
                <span className={`h-3 w-8 -skew-x-[20deg] ${col.bar}`} aria-hidden />
                <h2 className={`font-display text-lg font-bold uppercase ${col.text}`}>
                  {col.label}
                </h2>
                <span className={`badge ml-auto ${col.count}`}>{colTasks.length}</span>
              </header>

              <div className="flex flex-1 flex-col gap-2 p-3">
                {colTasks.map((task, idx) => (
                  <div key={task.id}>
                    {isTarget && draggingId && dropTarget.index === idx && (
                      <div className={`mb-2 h-0.5 ${col.bar}`} aria-hidden />
                    )}
                    <TaskCard
                      task={task}
                      dragging={draggingId === task.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(task.id);
                      }}
                      onDragEnd={resetDrag}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > rect.top + rect.height / 2;
                        setDropTarget({
                          status: col.status,
                          index: idx + (after ? 1 : 0),
                        });
                      }}
                      onClick={() => setOpenTaskId(task.id)}
                    />
                  </div>
                ))}

                {isTarget && draggingId && dropTarget.index >= colTasks.length && (
                  <div className={`h-0.5 ${col.bar}`} aria-hidden />
                )}

                {colTasks.length === 0 && !draggingId && composer !== col.status && (
                  <p className="px-1 py-2 font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
                    {hasFilters ? "Aucune carte ne correspond aux filtres" : "Aucune tâche"}
                  </p>
                )}

                {/* Composer inline façon Trello */}
                {composer === col.status ? (
                  <div className="mt-auto">
                    <textarea
                      ref={composerRef}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void submitComposer(col.status);
                        }
                        if (e.key === "Escape") {
                          setComposer(null);
                          setComposerText("");
                        }
                      }}
                      rows={2}
                      placeholder="Saisissez un titre pour cette carte…"
                      className="w-full rounded-none border border-violet bg-base px-3 py-2 text-sm text-ink outline-none"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitComposer(col.status)}
                        className="btn btn-primary !px-4 !py-1.5"
                      >
                        Ajouter la carte
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setComposer(null);
                          setComposerText("");
                        }}
                        aria-label="Annuler"
                        className="px-2 font-display text-lg text-ink-faint transition hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setComposer(col.status);
                      setComposerText("");
                    }}
                    className="mt-auto border border-dashed border-hair px-3 py-2 font-nav text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:border-violet hover:text-white"
                  >
                    + Ajouter une carte
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openTask && (
        <CardModal
          task={openTask}
          columnLabel={COLUMNS.find((c) => c.status === openTask.status)?.label ?? ""}
          boardLabels={boardLabels}
          assignables={assignables}
          onTaskResult={applyTaskResult}
          onLabelCreated={labelCreated}
          onLabelUpdated={labelUpdated}
          onLabelDeleted={labelDeleted}
          onMove={(status) => void moveTask(openTask.id, status, columns[status].length)}
          onDeleted={removeTask}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
