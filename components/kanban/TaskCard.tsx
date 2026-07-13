"use client";

import {
  checklistProgress,
  dueState,
  memberInitials,
  memberName,
  PRIORITY_LABELS,
  type TaskDto,
} from "./types";

const PRIORITY_BADGE: Record<number, string> = {
  0: "border-hair bg-surface text-ink-faint",
  1: "border-gold/50 bg-gold/10 text-gold",
  2: "border-danger/50 bg-danger/10 text-danger",
};

const DUE_BADGE: Record<string, string> = {
  done: "border-lime/50 bg-lime/10 text-lime",
  overdue: "border-danger/50 bg-danger/10 text-danger",
  soon: "border-gold/50 bg-gold/10 text-gold",
  normal: "border-hair bg-surface text-ink-soft",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function Avatar({ member, size = "h-6 w-6" }: { member: TaskDto["members"][number]; size?: string }) {
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
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border border-violet/40 bg-violet/15 font-nav text-[0.6rem] font-bold text-violet-bright`}
    >
      {memberInitials(member)}
    </span>
  );
}

export default function TaskCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onClick,
}: {
  task: TaskDto;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
}) {
  const due = dueState(task);
  const progress = checklistProgress(task);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`panel cursor-grab select-none overflow-hidden transition hover:border-violet hover:bg-surface-raised active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      {task.coverColor && (
        <div className="h-2" style={{ backgroundColor: task.coverColor }} aria-hidden />
      )}

      <div className="p-3">
        {task.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {task.labels.map((l) => (
              <span
                key={l.id}
                title={l.name}
                className="inline-flex h-2 min-w-[2rem] items-center rounded-full px-1.5"
                style={{ backgroundColor: l.color }}
              >
                {l.name && (
                  <span className="sr-only">{l.name}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="font-display text-sm font-bold uppercase leading-tight text-white">
          {task.title}
        </div>

        {/* Badges façon Trello : échéance, description, commentaires, PJ, checklist */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`badge ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE[0]}`}>
            {PRIORITY_LABELS[task.priority] ?? "Basse"}
          </span>
          {due && task.dueAt && (
            <span className={`badge ${DUE_BADGE[due]}`} title="Échéance">
              ⏱ {dateFmt.format(new Date(task.dueAt))}
            </span>
          )}
          {task.description && (
            <span className="font-nav text-[0.65rem] text-ink-faint" title="A une description">
              ≡
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="font-nav text-[0.65rem] text-ink-faint" title="Commentaires">
              💬 {task.comments.length}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="font-nav text-[0.65rem] text-ink-faint" title="Pièces jointes">
              📎 {task.attachments.length}
            </span>
          )}
          {progress.total > 0 && (
            <span
              className={`badge ${
                progress.done === progress.total
                  ? "border-lime/50 bg-lime/10 text-lime"
                  : "border-hair bg-surface text-ink-soft"
              }`}
              title="Checklist"
            >
              ☑ {progress.done}/{progress.total}
            </span>
          )}
        </div>

        {task.members.length > 0 && (
          <div className="mt-2 flex justify-end -space-x-1.5">
            {task.members.slice(0, 4).map((m) => (
              <Avatar key={m.id} member={m} />
            ))}
            {task.members.length > 4 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-hair bg-surface font-nav text-[0.6rem] text-ink-soft">
                +{task.members.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
