"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AssoNavItem {
  href: string;
  label: string;
  /** Active uniquement sur l'URL exacte (sinon par préfixe). */
  exact?: boolean;
}

/**
 * Sidebar de l'espace de gestion d'UNE association — le pendant asso du
 * "Poste de commandement". Les entrées sont calculées côté serveur selon
 * les droits par module (RG-01) et passées en props.
 */
export default function AssoSideNav({
  items,
  color,
}: {
  items: AssoNavItem[];
  color: string;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item, i) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
            <span className="text-[0.65rem]" style={{ color }}>
              {String(i).padStart(2, "0")}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
