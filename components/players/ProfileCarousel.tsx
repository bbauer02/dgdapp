"use client";

import { useState } from "react";

export interface CarouselSection {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Vertical section carousel — reprend le "team-carousel" du template
 * Necromancers : une section visible à la fois, pilotée par un rail vertical
 * latéral (labels numérotés). Bascule en rail horizontal sur mobile.
 */
export default function ProfileCarousel({
  sections,
  color,
}: {
  sections: CarouselSection[];
  color: string;
}) {
  const [active, setActive] = useState(0);
  const last = sections.length - 1;
  const go = (i: number) => setActive(Math.max(0, Math.min(last, i)));

  const ctrlBtn =
    "grid h-9 w-9 place-items-center rounded-none border border-hair text-ink-soft transition hover:border-violet hover:text-white disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Vertical navigation rail */}
        <nav
          aria-label="Sections du profil"
          className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-24 lg:h-fit lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {sections.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-current={on ? "true" : undefined}
                className={`group flex shrink-0 items-center gap-3 border-l-2 px-4 py-3 text-left font-nav text-xs font-semibold uppercase tracking-wider transition ${
                  on
                    ? "bg-surface-raised text-white"
                    : "border-transparent text-ink-soft hover:bg-surface/60 hover:text-white"
                }`}
                style={on ? { borderColor: color } : undefined}
              >
                <span
                  className="font-display text-sm font-bold leading-none"
                  style={{ color: on ? color : undefined }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">
                  {s.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active panel */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-hair pb-4">
            <span className="font-nav text-xs uppercase tracking-[0.2em] text-ink-faint">
              <span className="text-lime">
                {String(active + 1).padStart(2, "0")}
              </span>{" "}
              / {String(sections.length).padStart(2, "0")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go(active - 1)}
                disabled={active === 0}
                aria-label="Section précédente"
                className={ctrlBtn}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => go(active + 1)}
                disabled={active === last}
                aria-label="Section suivante"
                className={ctrlBtn}
              >
                ↓
              </button>
            </div>
          </div>

          {/* key forces a remount so the reveal animation replays on change */}
          <div key={active} className="animate-fade-up">
            {sections[active].content}
          </div>
        </div>
      </div>
    </div>
  );
}
