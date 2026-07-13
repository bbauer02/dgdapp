"use client";

import { useRef, useState } from "react";
import Markdown from "@/components/ui/Markdown";

const inputClass =
  "w-full rounded-none border border-hair bg-base px-3 py-2 text-sm text-ink outline-none transition focus:border-violet";

/**
 * Markdown editor as a form field (submits through a textarea `name`):
 * Écrire/Aperçu tabs + a small formatting toolbar, Trello-style.
 */
export default function MarkdownEditor({
  name,
  label,
  defaultValue,
  rows = 6,
  placeholder,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /** Wraps the selection with `before`/`after` (or inserts a template). */
  function wrap(before: string, after = before, template = "texte") {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || template;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function linePrefix(prefix: string) {
    const el = areaRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  }

  const toolBtn =
    "border border-hair px-2 py-0.5 font-nav text-[0.7rem] font-bold text-ink-soft transition hover:border-violet hover:text-white";

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="stat-label">{label}</span>}
      <div className="border border-hair">
        <div className="flex flex-wrap items-center gap-1 border-b border-hair bg-surface px-2 py-1.5">
          <button type="button" onClick={() => wrap("**")} className={toolBtn} title="Gras">
            B
          </button>
          <button type="button" onClick={() => wrap("*")} className={`${toolBtn} italic`} title="Italique">
            I
          </button>
          <button type="button" onClick={() => linePrefix("## ")} className={toolBtn} title="Titre">
            H
          </button>
          <button type="button" onClick={() => linePrefix("- ")} className={toolBtn} title="Liste">
            •
          </button>
          <button
            type="button"
            onClick={() => wrap("[", "](https://)", "lien")}
            className={toolBtn}
            title="Lien"
          >
            🔗
          </button>
          <button type="button" onClick={() => linePrefix("> ")} className={toolBtn} title="Citation">
            ❝
          </button>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`${toolBtn} ${!preview ? "!border-violet !text-white" : ""}`}
            >
              Écrire
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`${toolBtn} ${preview ? "!border-violet !text-white" : ""}`}
            >
              Aperçu
            </button>
          </div>
        </div>

        {/* The textarea always carries the form value; hidden during preview. */}
        <textarea
          ref={areaRef}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? "Markdown supporté : **gras**, *italique*, ## titre, - liste…"}
          className={`${inputClass} border-0 ${preview ? "hidden" : ""}`}
        />
        {preview && (
          <div className="min-h-[6rem] bg-base px-3 py-2">
            {value.trim() ? (
              <Markdown>{value}</Markdown>
            ) : (
              <p className="font-nav text-xs text-ink-faint">Rien à prévisualiser.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
