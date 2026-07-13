"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Tableau de bord", code: "00" },
  { href: "/admin/events", label: "Événements", code: "01" },
  { href: "/admin/planner", label: "Plan de camp", code: "02" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 border-l-2 px-3 py-2 font-nav text-xs font-semibold uppercase tracking-wider transition ${
              active
                ? "border-lime bg-violet/10 text-white"
                : "border-transparent text-ink-soft hover:bg-surface-raised hover:text-white"
            }`}
          >
            <span className="text-[0.65rem] text-lime">{item.code}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
