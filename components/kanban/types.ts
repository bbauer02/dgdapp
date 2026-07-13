import type { KanbanStatus } from "@prisma/client";

// Plain serializable shapes exchanged between the kanban page (RSC),
// the server actions and the client board. Dates travel as ISO strings.

export type TaskMember = {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
};

/** Users offered in the members picker (inscrits + membres de l'asso). */
export type AssignableUser = TaskMember;

export type LabelDto = {
  id: string;
  name: string; // may be empty — colour-only label, like Trello
  color: string; // hex
};

export type CheckItemDto = {
  id: string;
  text: string;
  done: boolean;
  position: number;
};

export type ChecklistDto = {
  id: string;
  title: string;
  position: number;
  items: CheckItemDto[];
};

export type AttachmentDto = {
  id: string;
  url: string;
  name: string | null;
  createdAt: string;
};

export type CommentDto = {
  id: string;
  body: string;
  createdAt: string;
  author: TaskMember;
};

export type TaskDto = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  priority: number; // 0 basse · 1 normale · 2 haute
  position: number; // ordering inside a column
  startAt: string | null;
  dueAt: string | null;
  dueComplete: boolean;
  coverColor: string | null;
  archived: boolean;
  members: TaskMember[];
  labels: LabelDto[];
  checklists: ChecklistDto[];
  attachments: AttachmentDto[];
  comments: CommentDto[];
};

export const PRIORITY_LABELS: Record<number, string> = {
  0: "Basse",
  1: "Normale",
  2: "Haute",
};

/** Trello's label palette, recoloured for the Nécromant theme. */
export const LABEL_COLORS = [
  "#A3FF12", // lime
  "#FFC53D", // gold
  "#FF8A3D", // orange
  "#FF1C5C", // danger
  "#7C4DFF", // violet
  "#2D9CFF", // blue
  "#4DD8FF", // sky
  "#FF6BD6", // pink
  "#6E6788", // gray
] as const;

/** Card cover colours (banner above the card, like Trello covers). */
export const COVER_COLORS = [
  "#7C4DFF",
  "#A3FF12",
  "#FFC53D",
  "#FF8A3D",
  "#FF1C5C",
  "#2D9CFF",
  "#FF6BD6",
  "#6E6788",
] as const;

export function memberName(m: TaskMember): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

export function memberInitials(m: TaskMember): string {
  return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
}

export type DueState = "overdue" | "soon" | "done" | "normal";

/** Trello due-badge semantics: green when complete, red overdue, gold <24h. */
export function dueState(task: Pick<TaskDto, "dueAt" | "dueComplete">): DueState | null {
  if (!task.dueAt) return null;
  if (task.dueComplete) return "done";
  const due = new Date(task.dueAt).getTime();
  const now = Date.now();
  if (due < now) return "overdue";
  if (due - now < 24 * 60 * 60 * 1000) return "soon";
  return "normal";
}

export function checklistProgress(task: Pick<TaskDto, "checklists">): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const cl of task.checklists) {
    total += cl.items.length;
    done += cl.items.filter((i) => i.done).length;
  }
  return { done, total };
}
