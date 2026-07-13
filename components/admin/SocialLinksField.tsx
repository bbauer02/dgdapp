"use client";

import { useState } from "react";

export type SocialLink = { label: string; url: string };

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet";

const SUGGESTIONS = ["Facebook", "Instagram", "Discord", "Site web", "YouTube", "TikTok"];

/**
 * Editable list of { label, url } social links, submitted as JSON through a
 * hidden input `name`.
 */
export default function SocialLinksField({
  name,
  label: fieldLabel = "Réseaux sociaux",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: SocialLink[];
}) {
  const [links, setLinks] = useState<SocialLink[]>(defaultValue ?? []);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  function add() {
    const l = label.trim();
    const u = url.trim();
    if (!l || !u) return;
    setLinks((cur) => [...cur, { label: l, url: u }]);
    setLabel("");
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="stat-label">{fieldLabel}</span>
      <input type="hidden" name={name} value={JSON.stringify(links)} />

      {links.length > 0 && (
        <ul className="mb-1 flex flex-col gap-1">
          {links.map((l, i) => (
            <li key={i} className="flex items-center gap-2 border border-hair bg-base/60 px-3 py-1.5">
              <span className="font-nav text-xs font-bold uppercase tracking-wider text-lime">
                {l.label}
              </span>
              <span className="min-w-0 flex-1 truncate font-nav text-xs text-ink-soft">{l.url}</span>
              <button
                type="button"
                onClick={() => setLinks((cur) => cur.filter((_, j) => j !== i))}
                aria-label="Retirer le lien"
                className="text-ink-faint transition hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Facebook, Instagram…"
          list="social-suggestions"
          className={`${input} w-40`}
        />
        <datalist id="social-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="https://…"
          className={`${input} min-w-0 flex-1`}
        />
        <button type="button" onClick={add} className="btn btn-ghost shrink-0 !px-4 !py-1.5">
          Ajouter
        </button>
      </div>
    </div>
  );
}
