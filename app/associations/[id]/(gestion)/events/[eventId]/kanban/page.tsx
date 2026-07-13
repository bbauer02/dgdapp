import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEventModule } from "@/lib/permissions";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import EventTabs from "@/components/associations/EventTabs";
import type { AssignableUser, LabelDto, TaskDto } from "@/components/kanban/types";

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePicture: true,
} as const;

// Kanban de tâches par événement (RF-18/19) — cartes façon Trello.
export default async function EventKanbanPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;
  // RG-01 : Écriture sur Événements de l'association organisatrice.
  await requireEventModule(eventId, "EVENTS", "WRITE");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, associationId: true },
  });
  if (!event || event.associationId !== id) notFound();

  const [taskRows, boardLabels, registered, assoMembers] = await Promise.all([
    prisma.eventTask.findMany({
      where: { eventId },
      orderBy: [{ status: "asc" }, { position: "asc" }],
      include: {
        members: { select: USER_SELECT },
        labels: true,
        checklists: {
          orderBy: { position: "asc" },
          include: { items: { orderBy: { position: "asc" } } },
        },
        attachments: { orderBy: { createdAt: "asc" } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: USER_SELECT } },
        },
      },
    }),
    prisma.taskLabel.findMany({ where: { eventId }, orderBy: { name: "asc" } }),
    // Assignables : utilisateurs inscrits à l'événement…
    prisma.user.findMany({
      where: { registrations: { some: { eventId } } },
      select: USER_SELECT,
    }),
    // …plus les membres ACTIVE de l'association organisatrice.
    prisma.user.findMany({
      where: {
        memberships: { some: { associationId: id, status: "ACTIVE" } },
      },
      select: USER_SELECT,
    }),
  ]);

  const byId = new Map<string, AssignableUser>();
  for (const u of [...registered, ...assoMembers]) byId.set(u.id, u);
  const assignables = [...byId.values()].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr")
  );

  const tasks: TaskDto[] = taskRows.map((t) => ({
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
  }));

  const labels: LabelDto[] = boardLabels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  }));

  return (
    <div className="p-8">
      <Link
        href={`/associations/${id}/events`}
        className="font-nav text-xs uppercase tracking-wider text-ink-soft hover:text-lime"
      >
        ← Événements
      </Link>
      <div className="mt-3">
        <h1 className="mb-4 font-display text-4xl font-bold text-white">{event.title}</h1>
        <EventTabs base={`/associations/${id}/events/${event.id}`} />
      </div>

      <KanbanBoard
        eventId={event.id}
        initialTasks={tasks}
        initialLabels={labels}
        assignables={assignables}
      />
    </div>
  );
}
