"use client";

import { useState, type ReactNode } from "react";

export interface SectionTab {
  key: string;
  label: string;
  /** Compteur affiché en badge à côté du libellé (masqué si absent). */
  count?: number;
  /** Le compteur signale du travail en attente → badge orange. */
  urgent?: boolean;
  content: ReactNode;
}

/**
 * Onglets horizontaux pour découper une page d'administration dense.
 * Tous les panneaux restent montés (les formulaires gardent leur état) ;
 * seuls les inactifs sont masqués.
 */
export default function SectionTabs({
  tabs,
  color,
}: {
  tabs: SectionTab[];
  color: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-hair" role="tablist">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 font-nav text-xs font-semibold uppercase tracking-wider transition ${
                isActive ? "text-white" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`badge ${t.urgent ? "badge-wait" : "border-hair text-ink-soft"}`}>
                  {t.count}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 -skew-x-[20deg]"
                  style={{ background: color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active} className="pt-8">
          {t.content}
        </div>
      ))}
    </div>
  );
}
