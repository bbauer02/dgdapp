"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Onglets d'un événement en gestion : toutes les facettes (infos, inscrits,
 * kanban, plan de camp) restent à un clic les unes des autres.
 */
export default function EventTabs({
  base,
  registrationCount,
}: {
  /** /associations/[id]/events/[eventId] */
  base: string;
  registrationCount?: number;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: base, label: "Infos", exact: true },
    {
      href: `${base}/inscrits`,
      label: registrationCount != null ? `Inscrits · ${registrationCount}` : "Inscrits",
    },
    { href: `${base}/kanban`, label: "Kanban" },
    { href: `${base}/planner`, label: "Plan de camp" },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-1 border-b border-hair">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 font-nav text-xs font-semibold uppercase tracking-wider transition ${
              active
                ? "border-lime text-white"
                : "border-transparent text-ink-soft hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
