"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { KanbanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";
import type { LabelDto, TaskDto } from "@/components/kanban/types";

// Kanban de tâches par événement (RF-18/19), cartes façon Trello : membres
// multiples, labels, dates, checklists, pièces jointes (URLs), commentaires,
// couverture, archivage. Toutes les actions sont gardées par le droit
// Écriture sur le module Événements de l'association organisatrice (RG-01 —
// les server actions sont invocables directement).

export type TaskResult = { ok: true; task: TaskDto } | { error: string };
export type LabelResult = { ok: true; label: LabelDto } | { error: string };
export type SimpleResult = { ok: true } | { error: string };

const statusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide");
// ISO datetime or null; empty string counts as null.
const isoDate = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Date invalide")
  .nullish();

const MEMBER_SELECT = {
  select: { id: true, firstName: true, lastName: true, profilePicture: true },
} as const;

const TASK_INCLUDE = {
  members: MEMBER_SELECT,
  labels: true,
  checklists: {
    orderBy: { position: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  },
  attachments: { orderBy: { createdAt: "asc" } },
  comments: { orderBy: { createdAt: "asc" }, include: { author: MEMBER_SELECT } },
} as const satisfies Prisma.EventTaskInclude;

type TaskRow = Prisma.EventTaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export type { TaskDto };

function toDto(t: TaskRow): TaskDto {
  return {
    id: t.id,
    eventId: t.eventId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    position: t.position,
    startAt: t.startAt?.toISOString() ?? null,
    dueAt: t.dueAt?.toISOString() ?? null,
    dueComplete: t.dueComplete,
    coverColor: t.coverColor,
    archived: t.archived,
    members: t.members,
    labels: t.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    checklists: t.checklists.map((cl) => ({
      id: cl.id,
      title: cl.title,
      position: cl.position,
      items: cl.items.map((i) => ({
        id: i.id,
        text: i.text,
        done: i.done,
        position: i.position,
      })),
    })),
    attachments: t.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      createdAt: a.createdAt.toISOString(),
    })),
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  };
}

// Le kanban vit sous /associations/[id]/events/[eventId]/kanban — les deux
// segments sont dynamiques, on revalide par motif de route.
function revalidateBoard(_eventId: string) {
  revalidatePath("/associations/[id]/events/[eventId]/kanban", "page");
}

type Session = Awaited<ReturnType<typeof requireEventModule>>;
type TaskGuard =
  | { ok: false; error: string }
  | {
      ok: true;
      task: { id: string; eventId: string; status: KanbanStatus; archived: boolean };
      session: Session;
    };

/** Loads the task, enforces WRITE on the organising association's Events. */
async function guardTask(taskId: string): Promise<TaskGuard> {
  const task = await prisma.eventTask.findUnique({
    where: { id: taskId },
    select: { id: true, eventId: true, status: true, archived: true },
  });
  if (!task) return { ok: false, error: "Tâche introuvable" };
  const session = await requireEventModule(task.eventId, "EVENTS", "WRITE");
  return { ok: true, task, session };
}

/** Re-reads the full card and returns it as the action result. */
async function refreshed(taskId: string, eventId: string): Promise<TaskResult> {
  const row = await prisma.eventTask.findUnique({
    where: { id: taskId },
    include: TASK_INCLUDE,
  });
  if (!row) return { error: "Tâche introuvable" };
  revalidateBoard((eventId));
  return { ok: true, task: toDto(row) };
}

// ---------------------------------------------------------------------------
// Cartes — création (composer inline), édition, déplacement, archivage
// ---------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  status: statusSchema.optional(),
});

export async function createTaskAction(
  eventId: string,
  input: { title: string; status?: "TODO" | "IN_PROGRESS" | "DONE" }
): Promise<TaskResult> {
  await requireEventModule(eventId, "EVENTS", "WRITE");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tâche invalide" };
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) return { error: "Événement introuvable" };

  const status = parsed.data.status ?? "TODO";
  // Ajout en fin de colonne (cartes actives seulement).
  const count = await prisma.eventTask.count({
    where: { eventId, status, archived: false },
  });
  const created = await prisma.eventTask.create({
    data: { eventId, title: parsed.data.title, status, position: count, priority: 1 },
    include: TASK_INCLUDE,
  });
  revalidateBoard((eventId));
  return { ok: true, task: toDto(created) };
}

const updateSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").optional(),
  description: z.string().trim().nullish(),
  priority: z.number().int().min(0).max(2).optional(),
  startAt: isoDate,
  dueAt: isoDate,
  dueComplete: z.boolean().optional(),
  // null → retirer la couverture.
  coverColor: hexColor.nullish(),
});

export async function updateTaskAction(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: number;
    startAt?: string | null;
    dueAt?: string | null;
    dueComplete?: boolean;
    coverColor?: string | null;
  }
): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tâche invalide" };
  }
  const d = parsed.data;
  const toDate = (s: string | null | undefined) =>
    s === undefined ? undefined : s ? new Date(s) : null;

  await prisma.eventTask.update({
    where: { id: taskId },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.startAt !== undefined ? { startAt: toDate(d.startAt) } : {}),
      ...(d.dueAt !== undefined ? { dueAt: toDate(d.dueAt) } : {}),
      ...(d.dueComplete !== undefined ? { dueComplete: d.dueComplete } : {}),
      ...(d.coverColor !== undefined ? { coverColor: d.coverColor } : {}),
    },
  });
  return refreshed(taskId, g.task.eventId);
}

/**
 * Déplace une tâche vers (status, position) et réindexe les colonnes touchées.
 * `position` = index visé dans la colonne de destination, la tâche déplacée
 * exclue (0 = tout en haut). Les positions des deux colonnes sont recompactées
 * en 0..n-1 dans une transaction. Les cartes archivées sont hors colonnes.
 */
export async function moveTaskAction(
  taskId: string,
  status: "TODO" | "IN_PROGRESS" | "DONE",
  position: number
): Promise<SimpleResult> {
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success || !Number.isInteger(position) || position < 0) {
    return { error: "Déplacement invalide" };
  }
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const { task } = g;

  await prisma.$transaction(async (tx) => {
    const dest = await tx.eventTask.findMany({
      where: { eventId: task.eventId, status, archived: false, id: { not: taskId } },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    const insertAt = Math.min(position, dest.length);
    const ordered = dest.map((t) => t.id);
    ordered.splice(insertAt, 0, taskId);

    await tx.eventTask.update({ where: { id: taskId }, data: { status } });
    await Promise.all(
      ordered.map((id, i) => tx.eventTask.update({ where: { id }, data: { position: i } }))
    );

    if (task.status !== status) {
      const src = await tx.eventTask.findMany({
        where: {
          eventId: task.eventId,
          status: task.status,
          archived: false,
          id: { not: taskId },
        },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      await Promise.all(
        src.map((t, i) => tx.eventTask.update({ where: { id: t.id }, data: { position: i } }))
      );
    }
  });

  revalidateBoard((task.eventId));
  return { ok: true };
}

/** Archive (la carte quitte le board) ou restaure (fin de sa colonne). */
export async function setTaskArchivedAction(
  taskId: string,
  archived: boolean
): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const { task } = g;

  await prisma.$transaction(async (tx) => {
    if (archived) {
      await tx.eventTask.update({ where: { id: taskId }, data: { archived: true } });
      // Recompacte la colonne quittée.
      const rest = await tx.eventTask.findMany({
        where: { eventId: task.eventId, status: task.status, archived: false },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      await Promise.all(
        rest.map((t, i) => tx.eventTask.update({ where: { id: t.id }, data: { position: i } }))
      );
    } else {
      const count = await tx.eventTask.count({
        where: { eventId: task.eventId, status: task.status, archived: false },
      });
      await tx.eventTask.update({
        where: { id: taskId },
        data: { archived: false, position: count },
      });
    }
  });
  return refreshed(taskId, task.eventId);
}

/** Suppression définitive — réservée aux cartes archivées, comme Trello. */
export async function deleteTaskAction(taskId: string): Promise<SimpleResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  if (!g.task.archived) {
    return { error: "Archivez la carte avant de la supprimer définitivement." };
  }
  await prisma.eventTask.delete({ where: { id: taskId } });
  revalidateBoard((g.task.eventId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Membres (RF-19 — multi-membres façon Trello)
// ---------------------------------------------------------------------------

export async function toggleTaskMemberAction(
  taskId: string,
  userId: string,
  on: boolean
): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  if (on) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { error: "Membre introuvable" };
  }
  await prisma.eventTask.update({
    where: { id: taskId },
    data: { members: on ? { connect: { id: userId } } : { disconnect: { id: userId } } },
  });
  return refreshed(taskId, g.task.eventId);
}

// ---------------------------------------------------------------------------
// Labels — définis au niveau de l'événement (board), posés sur les cartes
// ---------------------------------------------------------------------------

const labelSchema = z.object({
  name: z.string().trim().max(60, "Nom trop long"), // vide autorisé (couleur seule)
  color: hexColor,
});

export async function createLabelAction(
  eventId: string,
  input: { name: string; color: string }
): Promise<LabelResult> {
  await requireEventModule(eventId, "EVENTS", "WRITE");
  const parsed = labelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Label invalide" };
  }
  const label = await prisma.taskLabel.create({
    data: { eventId, name: parsed.data.name, color: parsed.data.color },
  });
  revalidateBoard((eventId));
  return { ok: true, label: { id: label.id, name: label.name, color: label.color } };
}

type LabelGuard =
  | { ok: false; error: string }
  | { ok: true; label: { id: string; eventId: string } };

async function guardLabel(labelId: string): Promise<LabelGuard> {
  const label = await prisma.taskLabel.findUnique({
    where: { id: labelId },
    select: { id: true, eventId: true },
  });
  if (!label) return { ok: false, error: "Label introuvable" };
  await requireEventModule(label.eventId, "EVENTS", "WRITE");
  return { ok: true, label };
}

export async function updateLabelAction(
  labelId: string,
  input: { name: string; color: string }
): Promise<LabelResult> {
  const g = await guardLabel(labelId);
  if (!g.ok) return { error: g.error };
  const parsed = labelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Label invalide" };
  }
  const label = await prisma.taskLabel.update({
    where: { id: labelId },
    data: { name: parsed.data.name, color: parsed.data.color },
  });
  revalidateBoard((g.label.eventId));
  return { ok: true, label: { id: label.id, name: label.name, color: label.color } };
}

/** Retire le label de toutes les cartes du board. */
export async function deleteLabelAction(labelId: string): Promise<SimpleResult> {
  const g = await guardLabel(labelId);
  if (!g.ok) return { error: g.error };
  await prisma.taskLabel.delete({ where: { id: labelId } });
  revalidateBoard((g.label.eventId));
  return { ok: true };
}

export async function toggleTaskLabelAction(
  taskId: string,
  labelId: string,
  on: boolean
): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const label = await prisma.taskLabel.findUnique({
    where: { id: labelId },
    select: { id: true, eventId: true },
  });
  if (!label || label.eventId !== g.task.eventId) return { error: "Label introuvable" };
  await prisma.eventTask.update({
    where: { id: taskId },
    data: { labels: on ? { connect: { id: labelId } } : { disconnect: { id: labelId } } },
  });
  return refreshed(taskId, g.task.eventId);
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export async function addChecklistAction(taskId: string, title: string): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const t = title.trim() || "Checklist";
  const position = await prisma.taskChecklist.count({ where: { taskId } });
  await prisma.taskChecklist.create({ data: { taskId, title: t, position } });
  return refreshed(taskId, g.task.eventId);
}

type ChecklistGuard =
  | { ok: false; error: string }
  | { ok: true; checklist: { id: string; taskId: string; task: { eventId: string } } };

async function guardChecklist(checklistId: string): Promise<ChecklistGuard> {
  const checklist = await prisma.taskChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, taskId: true, task: { select: { eventId: true } } },
  });
  if (!checklist) return { ok: false, error: "Checklist introuvable" };
  await requireEventModule(checklist.task.eventId, "EVENTS", "WRITE");
  return { ok: true, checklist };
}

export async function renameChecklistAction(
  checklistId: string,
  title: string
): Promise<TaskResult> {
  const g = await guardChecklist(checklistId);
  if (!g.ok) return { error: g.error };
  const t = title.trim();
  if (!t) return { error: "Titre requis" };
  await prisma.taskChecklist.update({ where: { id: checklistId }, data: { title: t } });
  return refreshed(g.checklist.taskId, g.checklist.task.eventId);
}

export async function deleteChecklistAction(checklistId: string): Promise<TaskResult> {
  const g = await guardChecklist(checklistId);
  if (!g.ok) return { error: g.error };
  await prisma.taskChecklist.delete({ where: { id: checklistId } });
  return refreshed(g.checklist.taskId, g.checklist.task.eventId);
}

export async function addCheckItemAction(
  checklistId: string,
  text: string
): Promise<TaskResult> {
  const g = await guardChecklist(checklistId);
  if (!g.ok) return { error: g.error };
  const t = text.trim();
  if (!t) return { error: "Texte requis" };
  const position = await prisma.taskCheckItem.count({ where: { checklistId } });
  await prisma.taskCheckItem.create({ data: { checklistId, text: t, position } });
  return refreshed(g.checklist.taskId, g.checklist.task.eventId);
}

type CheckItemGuard =
  | { ok: false; error: string }
  | {
      ok: true;
      item: { id: string; checklist: { taskId: string; task: { eventId: string } } };
    };

async function guardCheckItem(itemId: string): Promise<CheckItemGuard> {
  const item = await prisma.taskCheckItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      checklist: { select: { taskId: true, task: { select: { eventId: true } } } },
    },
  });
  if (!item) return { ok: false, error: "Élément introuvable" };
  await requireEventModule(item.checklist.task.eventId, "EVENTS", "WRITE");
  return { ok: true, item };
}

export async function setCheckItemDoneAction(
  itemId: string,
  done: boolean
): Promise<TaskResult> {
  const g = await guardCheckItem(itemId);
  if (!g.ok) return { error: g.error };
  await prisma.taskCheckItem.update({ where: { id: itemId }, data: { done } });
  return refreshed(g.item.checklist.taskId, g.item.checklist.task.eventId);
}

export async function deleteCheckItemAction(itemId: string): Promise<TaskResult> {
  const g = await guardCheckItem(itemId);
  if (!g.ok) return { error: g.error };
  await prisma.taskCheckItem.delete({ where: { id: itemId } });
  return refreshed(g.item.checklist.taskId, g.item.checklist.task.eventId);
}

// ---------------------------------------------------------------------------
// Pièces jointes — URLs (convention no-blob de l'app)
// ---------------------------------------------------------------------------

const attachmentSchema = z.object({
  // Absolute http(s) URL, or a path served by the app (uploads: "/uploads/…").
  url: z
    .string()
    .trim()
    .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "URL invalide"),
  name: z.string().trim().max(120).optional(),
});

export async function addAttachmentAction(
  taskId: string,
  input: { url: string; name?: string }
): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pièce jointe invalide" };
  }
  await prisma.taskAttachment.create({
    data: { taskId, url: parsed.data.url, name: parsed.data.name || null },
  });
  return refreshed(taskId, g.task.eventId);
}

export async function deleteAttachmentAction(attachmentId: string): Promise<TaskResult> {
  const att = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, taskId: true, task: { select: { eventId: true } } },
  });
  if (!att) return { error: "Pièce jointe introuvable" };
  await requireEventModule(att.task.eventId, "EVENTS", "WRITE");
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  return refreshed(att.taskId, att.task.eventId);
}

// ---------------------------------------------------------------------------
// Commentaires
// ---------------------------------------------------------------------------

export async function addCommentAction(taskId: string, body: string): Promise<TaskResult> {
  const g = await guardTask(taskId);
  if (!g.ok) return { error: g.error };
  const text = body.trim();
  if (!text) return { error: "Commentaire vide" };
  await prisma.taskComment.create({
    data: { taskId, authorId: g.session.user.id, body: text },
  });
  return refreshed(taskId, g.task.eventId);
}

export async function deleteCommentAction(commentId: string): Promise<TaskResult> {
  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, taskId: true, task: { select: { eventId: true } } },
  });
  if (!comment) return { error: "Commentaire introuvable" };
  await requireEventModule(comment.task.eventId, "EVENTS", "WRITE");
  await prisma.taskComment.delete({ where: { id: commentId } });
  return refreshed(comment.taskId, comment.task.eventId);
}
