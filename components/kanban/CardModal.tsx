"use client";

import { useEffect, useRef, useState } from "react";
import type { KanbanStatus } from "@prisma/client";
import { uploadFile } from "@/lib/upload-client";
import {
  addAttachmentAction,
  addChecklistAction,
  addCheckItemAction,
  addCommentAction,
  createLabelAction,
  deleteAttachmentAction,
  deleteCheckItemAction,
  deleteChecklistAction,
  deleteCommentAction,
  deleteLabelAction,
  deleteTaskAction,
  setCheckItemDoneAction,
  setTaskArchivedAction,
  toggleTaskLabelAction,
  toggleTaskMemberAction,
  updateLabelAction,
  updateTaskAction,
  type TaskResult,
} from "@/lib/actions/tasks";
import {
  COVER_COLORS,
  LABEL_COLORS,
  checklistProgress,
  dueState,
  memberInitials,
  memberName,
  PRIORITY_LABELS,
  type AssignableUser,
  type LabelDto,
  type TaskDto,
} from "./types";

// Dos de carte façon Trello : colonne principale (labels, membres, dates,
// description, checklists, pièces jointes, commentaires) + barre latérale
// "Ajouter à la carte" / "Actions".

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const DUE_CHIP: Record<string, string> = {
  done: "border-lime/50 bg-lime/10 text-lime",
  overdue: "border-danger/50 bg-danger/10 text-danger",
  soon: "border-gold/50 bg-gold/10 text-gold",
  normal: "border-hair bg-surface text-ink-soft",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

const input =
  "w-full rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet";

const sideBtn =
  "flex w-full items-center gap-2 border border-hair bg-surface px-3 py-2 text-left font-nav text-xs font-semibold uppercase tracking-wider text-ink-soft transition hover:border-violet hover:text-white";

function Avatar({ member, size = "h-7 w-7" }: { member: AssignableUser; size?: string }) {
  return member.profilePicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={member.profilePicture}
      alt={memberName(member)}
      title={memberName(member)}
      className={`${size} shrink-0 rounded-full border border-hair object-cover`}
    />
  ) : (
    <span
      title={memberName(member)}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border border-violet/40 bg-violet/15 font-nav text-[0.65rem] font-bold text-violet-bright`}
    >
      {memberInitials(member)}
    </span>
  );
}

type Panel =
  | "members"
  | "labels"
  | "dates"
  | "checklist"
  | "attachment"
  | "cover"
  | "move"
  | null;

export default function CardModal({
  task,
  columnLabel,
  boardLabels,
  assignables,
  onTaskResult,
  onLabelCreated,
  onLabelUpdated,
  onLabelDeleted,
  onMove,
  onDeleted,
  onClose,
}: {
  task: TaskDto;
  columnLabel: string;
  boardLabels: LabelDto[];
  assignables: AssignableUser[];
  /** Applique le TaskResult au board ; renvoie l'erreur éventuelle. */
  onTaskResult: (res: TaskResult) => string | null;
  onLabelCreated: (label: LabelDto) => void;
  onLabelUpdated: (label: LabelDto) => void;
  onLabelDeleted: (labelId: string) => void;
  onMove: (status: KanbanStatus) => void;
  onDeleted: (taskId: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);

  const [startAt, setStartAt] = useState(toLocalInput(task.startAt));
  const [dueAt, setDueAt] = useState(toLocalInput(task.dueAt));

  const [newChecklist, setNewChecklist] = useState("Checklist");
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [attachUrl, setAttachUrl] = useState("");
  const [attachName, setAttachName] = useState("");
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Label editor state (create or edit within the labels panel).
  const [labelEdit, setLabelEdit] = useState<{ id: string | null; name: string; color: string } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Resync local drafts when another mutation refreshed the card.
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStartAt(toLocalInput(task.startAt));
    setDueAt(toLocalInput(task.dueAt));
  }, [task]);

  async function run(fn: () => Promise<TaskResult>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const err = onTaskResult(res);
      if (err) setError(err);
      return !err;
    } catch {
      setError("Action impossible — réessayez.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const due = dueState(task);

  const isImageUrl = (url: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(url);

  async function uploadAttachment(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const up = await uploadFile(file);
      const err = onTaskResult(
        await addAttachmentAction(task.id, { url: up.url, name: up.name })
      );
      if (err) setError(err);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setUploading(false);
      if (attachFileRef.current) attachFileRef.current.value = "";
    }
  }

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-base/80 p-4 backdrop-blur-sm md:py-12"
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      <div className="panel w-full max-w-3xl animate-fade-up bg-surface">
        {task.coverColor && (
          <div className="h-8" style={{ backgroundColor: task.coverColor }} aria-hidden />
        )}

        <div className="flex items-start justify-between gap-3 border-b border-hair p-4">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const t = title.trim();
                if (t && t !== task.title) void run(() => updateTaskAction(task.id, { title: t }));
                else setTitle(task.title);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full border border-transparent bg-transparent font-display text-2xl font-bold uppercase text-white outline-none transition focus:border-hair focus:bg-base"
            />
            <p className="mt-1 font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
              Dans la liste <span className="text-ink-soft">{columnLabel}</span>
              {task.archived && (
                <span className="badge badge-no ml-2">Archivée</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 px-2 font-display text-xl text-ink-faint transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="badge badge-no m-4 mb-0" role="alert">
            {error}
          </div>
        )}

        <div className="grid gap-6 p-4 md:grid-cols-[1fr_13rem]">
          {/* ------------------------------------------------ colonne principale */}
          <div className="min-w-0">
            {/* Labels + membres + échéance, comme l'en-tête de carte Trello */}
            {(task.labels.length > 0 || task.members.length > 0 || task.dueAt || task.startAt) && (
              <div className="mb-5 flex flex-wrap items-start gap-x-6 gap-y-3">
                {task.labels.length > 0 && (
                  <div>
                    <div className="stat-label mb-1">Labels</div>
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center rounded-sm px-2 py-0.5 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-base"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name || "   "}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {task.members.length > 0 && (
                  <div>
                    <div className="stat-label mb-1">Membres</div>
                    <div className="flex -space-x-1.5">
                      {task.members.map((m) => (
                        <Avatar key={m.id} member={m} />
                      ))}
                    </div>
                  </div>
                )}
                {(task.dueAt || task.startAt) && (
                  <div>
                    <div className="stat-label mb-1">Dates</div>
                    <label
                      className={`badge cursor-pointer ${due ? DUE_CHIP[due] : "border-hair bg-surface text-ink-soft"}`}
                    >
                      {task.dueAt && (
                        <input
                          type="checkbox"
                          checked={task.dueComplete}
                          disabled={busy}
                          onChange={(e) =>
                            void run(() =>
                              updateTaskAction(task.id, { dueComplete: e.target.checked })
                            )
                          }
                          className="h-3 w-3 accent-lime"
                        />
                      )}
                      {task.startAt && dateTimeFmt.format(new Date(task.startAt))}
                      {task.startAt && task.dueAt && " → "}
                      {task.dueAt && dateTimeFmt.format(new Date(task.dueAt))}
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <section className="mb-6">
              <h3 className="stat-label mb-2">≡ Description</h3>
              {editingDesc ? (
                <div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    autoFocus
                    className={input}
                    placeholder="Ajouter une description plus détaillée…"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await run(() =>
                          updateTaskAction(task.id, { description: description.trim() || null })
                        );
                        if (ok) setEditingDesc(false);
                      }}
                      className="btn btn-primary !px-4 !py-1.5"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(task.description ?? "");
                        setEditingDesc(false);
                      }}
                      className="btn btn-ghost !px-4 !py-1.5"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingDesc(true)}
                  className="block w-full whitespace-pre-wrap border border-transparent bg-base/60 px-3 py-2 text-left text-sm text-ink-soft transition hover:border-hair"
                >
                  {task.description || "Ajouter une description plus détaillée…"}
                </button>
              )}
            </section>

            {/* Checklists */}
            {task.checklists.map((cl) => {
              const total = cl.items.length;
              const done = cl.items.filter((i) => i.done).length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <section key={cl.id} className="mb-6">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="stat-label">☑ {cl.title}</h3>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => deleteChecklistAction(cl.id))}
                      className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
                    >
                      Supprimer
                    </button>
                  </div>
                  {/* Barre de progression Trello */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="w-8 font-nav text-[0.65rem] text-ink-faint">{pct}%</span>
                    <div className="h-1.5 flex-1 bg-base">
                      <div
                        className={`h-full transition-all ${pct === 100 ? "bg-lime" : "bg-violet"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {cl.items.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2 px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={busy}
                          onChange={(e) =>
                            void run(() => setCheckItemDoneAction(item.id, e.target.checked))
                          }
                          className="h-4 w-4 accent-violet"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            item.done ? "text-ink-faint line-through" : "text-ink"
                          }`}
                        >
                          {item.text}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => deleteCheckItemAction(item.id))}
                          aria-label="Supprimer l'élément"
                          className="text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-danger"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const text = (itemDrafts[cl.id] ?? "").trim();
                      if (!text) return;
                      const ok = await run(() => addCheckItemAction(cl.id, text));
                      if (ok) setItemDrafts((d) => ({ ...d, [cl.id]: "" }));
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      value={itemDrafts[cl.id] ?? ""}
                      onChange={(e) => setItemDrafts((d) => ({ ...d, [cl.id]: e.target.value }))}
                      placeholder="Ajouter un élément"
                      className={input}
                    />
                    <button type="submit" disabled={busy} className="btn btn-ghost shrink-0 !px-4 !py-1.5">
                      Ajouter
                    </button>
                  </form>
                </section>
              );
            })}

            {/* Pièces jointes */}
            {task.attachments.length > 0 && (
              <section className="mb-6">
                <h3 className="stat-label mb-2">📎 Pièces jointes</h3>
                <ul className="flex flex-col gap-1">
                  {task.attachments.map((a) => (
                    <li key={a.id} className="group flex items-center gap-2 border border-hair bg-base/60 px-3 py-2">
                      {isImageUrl(a.url) && (
                        <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.name ?? ""}
                            className="h-12 w-16 border border-hair object-cover"
                          />
                        </a>
                      )}
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-ink hover:text-lime hover:underline"
                        title={a.url}
                      >
                        {a.name || a.url}
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => deleteAttachmentAction(a.id))}
                        aria-label="Supprimer la pièce jointe"
                        className="text-ink-faint transition hover:text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Commentaires */}
            <section>
              <h3 className="stat-label mb-2">💬 Commentaires</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body = comment.trim();
                  if (!body) return;
                  const ok = await run(() => addCommentAction(task.id, body));
                  if (ok) setComment("");
                }}
                className="mb-3 flex gap-2"
              >
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Écrire un commentaire…"
                  className={input}
                />
                <button type="submit" disabled={busy} className="btn btn-primary shrink-0 !px-4 !py-1.5">
                  Envoyer
                </button>
              </form>
              <ul className="flex flex-col gap-3">
                {[...task.comments].reverse().map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <Avatar member={c.author} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-nav text-xs font-bold uppercase tracking-wider text-white">
                          {memberName(c.author)}
                        </span>
                        <span className="font-nav text-[0.6rem] text-ink-faint">
                          {dateTimeFmt.format(new Date(c.createdAt))}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => deleteCommentAction(c.id))}
                          className="ml-auto font-nav text-[0.6rem] uppercase text-ink-faint transition hover:text-danger"
                        >
                          Supprimer
                        </button>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap border border-hair bg-base/60 px-3 py-2 text-sm text-ink">
                        {c.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ------------------------------------------------------- sidebar */}
          <aside className="flex flex-col gap-1.5">
            <div className="stat-label mb-1">Ajouter à la carte</div>

            {/* Membres */}
            <button type="button" onClick={() => setPanel(panel === "members" ? null : "members")} className={sideBtn}>
              👤 Membres
            </button>
            {panel === "members" && (
              <div className="border border-hair bg-base/60 p-2">
                {assignables.length === 0 && (
                  <p className="px-1 py-0.5 font-nav text-[0.65rem] text-ink-faint">
                    Aucun membre disponible.
                  </p>
                )}
                {assignables.map((u) => {
                  const on = task.members.some((m) => m.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => toggleTaskMemberAction(task.id, u.id, !on))}
                      className="flex w-full items-center gap-2 px-1 py-1 text-left transition hover:bg-surface-raised"
                    >
                      <Avatar member={u} size="h-6 w-6" />
                      <span className="min-w-0 flex-1 truncate font-nav text-xs text-ink">
                        {memberName(u)}
                      </span>
                      {on && <span className="text-lime">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Labels */}
            <button type="button" onClick={() => setPanel(panel === "labels" ? null : "labels")} className={sideBtn}>
              🏷 Labels
            </button>
            {panel === "labels" && (
              <div className="border border-hair bg-base/60 p-2">
                {labelEdit ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError(null);
                      try {
                        const res = labelEdit.id
                          ? await updateLabelAction(labelEdit.id, {
                              name: labelEdit.name,
                              color: labelEdit.color,
                            })
                          : await createLabelAction(task.eventId, {
                              name: labelEdit.name,
                              color: labelEdit.color,
                            });
                        if ("error" in res) setError(res.error);
                        else {
                          if (labelEdit.id) onLabelUpdated(res.label);
                          else {
                            onLabelCreated(res.label);
                            // Un label créé depuis la carte y est posé directement.
                            const r2 = await toggleTaskLabelAction(task.id, res.label.id, true);
                            const err = onTaskResult(r2);
                            if (err) setError(err);
                          }
                          setLabelEdit(null);
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <input
                      value={labelEdit.name}
                      onChange={(e) => setLabelEdit({ ...labelEdit, name: e.target.value })}
                      placeholder="Nom (optionnel)"
                      className={`${input} mb-2`}
                    />
                    <div className="mb-2 grid grid-cols-5 gap-1">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setLabelEdit({ ...labelEdit, color: c })}
                          aria-label={c}
                          className={`h-6 rounded-sm transition ${
                            labelEdit.color === c ? "ring-2 ring-white" : ""
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="submit" disabled={busy} className="btn btn-primary !px-3 !py-1">
                        {labelEdit.id ? "Enregistrer" : "Créer"}
                      </button>
                      {labelEdit.id && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await deleteLabelAction(labelEdit.id!);
                              if ("error" in res) setError(res.error);
                              else {
                                onLabelDeleted(labelEdit.id!);
                                setLabelEdit(null);
                              }
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="font-nav text-[0.65rem] uppercase text-ink-faint hover:text-danger"
                        >
                          Supprimer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setLabelEdit(null)}
                        className="ml-auto font-nav text-[0.65rem] uppercase text-ink-faint hover:text-white"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {boardLabels.map((l) => {
                      const on = task.labels.some((x) => x.id === l.id);
                      return (
                        <div key={l.id} className="mb-1 flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run(() => toggleTaskLabelAction(task.id, l.id, !on))}
                            className="flex h-7 min-w-0 flex-1 items-center justify-between rounded-sm px-2 font-nav text-[0.65rem] font-bold uppercase tracking-wider text-base transition hover:opacity-80"
                            style={{ backgroundColor: l.color }}
                          >
                            <span className="truncate">{l.name}</span>
                            {on && <span>✓</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLabelEdit({ id: l.id, name: l.name, color: l.color })}
                            aria-label="Modifier le label"
                            className="px-1 text-ink-faint transition hover:text-white"
                          >
                            ✎
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setLabelEdit({ id: null, name: "", color: LABEL_COLORS[4] })}
                      className="mt-1 w-full border border-dashed border-hair px-2 py-1 font-nav text-[0.65rem] uppercase tracking-wider text-ink-soft transition hover:border-violet hover:text-white"
                    >
                      + Créer un label
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Dates */}
            <button type="button" onClick={() => setPanel(panel === "dates" ? null : "dates")} className={sideBtn}>
              ⏱ Dates
            </button>
            {panel === "dates" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(() =>
                    updateTaskAction(task.id, {
                      startAt: fromLocalInput(startAt),
                      dueAt: fromLocalInput(dueAt),
                    })
                  );
                  if (ok) setPanel(null);
                }}
                className="border border-hair bg-base/60 p-2"
              >
                <label className="mb-2 block">
                  <span className="stat-label">Début</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="mb-2 block">
                  <span className="stat-label">Échéance</span>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className={input}
                  />
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="btn btn-primary !px-3 !py-1">
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(() =>
                        updateTaskAction(task.id, { startAt: null, dueAt: null, dueComplete: false })
                      );
                      if (ok) setPanel(null);
                    }}
                    className="font-nav text-[0.65rem] uppercase text-ink-faint hover:text-danger"
                  >
                    Retirer
                  </button>
                </div>
              </form>
            )}

            {/* Checklist */}
            <button type="button" onClick={() => setPanel(panel === "checklist" ? null : "checklist")} className={sideBtn}>
              ☑ Checklist
            </button>
            {panel === "checklist" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(() => addChecklistAction(task.id, newChecklist));
                  if (ok) {
                    setNewChecklist("Checklist");
                    setPanel(null);
                  }
                }}
                className="border border-hair bg-base/60 p-2"
              >
                <input
                  value={newChecklist}
                  onChange={(e) => setNewChecklist(e.target.value)}
                  className={`${input} mb-2`}
                />
                <button type="submit" disabled={busy} className="btn btn-primary !px-3 !py-1">
                  Ajouter
                </button>
              </form>
            )}

            {/* Pièce jointe */}
            <button type="button" onClick={() => setPanel(panel === "attachment" ? null : "attachment")} className={sideBtn}>
              📎 Pièce jointe
            </button>
            {panel === "attachment" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(() =>
                    addAttachmentAction(task.id, {
                      url: attachUrl,
                      name: attachName || undefined,
                    })
                  );
                  if (ok) {
                    setAttachUrl("");
                    setAttachName("");
                    setPanel(null);
                  }
                }}
                className="border border-hair bg-base/60 p-2"
              >
                <input
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                  placeholder="https://…"
                  className={`${input} mb-2`}
                />
                <input
                  value={attachName}
                  onChange={(e) => setAttachName(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className={`${input} mb-2`}
                />
                <button type="submit" disabled={busy} className="btn btn-primary !px-3 !py-1">
                  Joindre
                </button>
                <div className="my-2 border-t border-hair" />
                <button
                  type="button"
                  disabled={busy || uploading}
                  onClick={() => attachFileRef.current?.click()}
                  className="w-full border border-dashed border-hair px-2 py-1.5 font-nav text-[0.65rem] uppercase tracking-wider text-ink-soft transition hover:border-violet hover:text-white disabled:opacity-60"
                >
                  {uploading ? "Envoi…" : "⬆ Uploader un fichier ou une image"}
                </button>
                <input
                  ref={attachFileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => void uploadAttachment(e.target.files?.[0])}
                />
              </form>
            )}

            {/* Couverture */}
            <button type="button" onClick={() => setPanel(panel === "cover" ? null : "cover")} className={sideBtn}>
              🎨 Couverture
            </button>
            {panel === "cover" && (
              <div className="border border-hair bg-base/60 p-2">
                <div className="mb-2 grid grid-cols-4 gap-1">
                  {COVER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => updateTaskAction(task.id, { coverColor: c }))}
                      aria-label={c}
                      className={`h-8 rounded-sm transition ${
                        task.coverColor === c ? "ring-2 ring-white" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                {task.coverColor && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => updateTaskAction(task.id, { coverColor: null }))}
                    className="w-full border border-hair px-2 py-1 font-nav text-[0.65rem] uppercase text-ink-soft transition hover:text-danger"
                  >
                    Retirer la couverture
                  </button>
                )}
              </div>
            )}

            {/* Priorité (héritage RF — pas Trello mais conservé) */}
            <label className="mt-2 block">
              <span className="stat-label">Priorité</span>
              <select
                value={task.priority}
                disabled={busy}
                onChange={(e) =>
                  void run(() => updateTaskAction(task.id, { priority: Number(e.target.value) }))
                }
                className={input}
              >
                {Object.entries(PRIORITY_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="stat-label mb-1 mt-4">Actions</div>

            {/* Déplacer */}
            <button type="button" onClick={() => setPanel(panel === "move" ? null : "move")} className={sideBtn}>
              → Déplacer
            </button>
            {panel === "move" && (
              <div className="border border-hair bg-base/60 p-2">
                {(
                  [
                    ["TODO", "À faire"],
                    ["IN_PROGRESS", "En cours"],
                    ["DONE", "Terminé"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy || task.status === status}
                    onClick={() => {
                      onMove(status);
                      setPanel(null);
                    }}
                    className="block w-full px-2 py-1 text-left font-nav text-xs text-ink transition hover:bg-surface-raised disabled:opacity-40"
                  >
                    {label}
                    {task.status === status && " (actuelle)"}
                  </button>
                ))}
              </div>
            )}

            {task.archived ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => setTaskArchivedAction(task.id, false))}
                  className={sideBtn}
                >
                  ↩ Renvoyer au tableau
                </button>
                {confirmDelete ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await deleteTaskAction(task.id);
                        if ("error" in res) setError(res.error);
                        else {
                          onDeleted(task.id);
                          onClose();
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`${sideBtn} !border-danger/50 !text-danger`}
                  >
                    ⚠ Confirmer la suppression
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={`${sideBtn} !text-danger`}
                  >
                    ✕ Supprimer
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => setTaskArchivedAction(task.id, true))}
                className={sideBtn}
              >
                🗄 Archiver
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
