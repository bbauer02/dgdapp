"use client";

import { useEffect, useId, useState } from "react";

/**
 * Colour picker that also shows (and lets you type) the #RRGGBB code.
 * Controlled: pass `value` + `onChange`. Accepts #RGB or #RRGGBB when typing
 * and normalizes to #RRGGBB. Pass `name` to also submit the value in a form.
 */
export default function ColorField({
  value,
  onChange,
  name,
  swatchClassName = "h-8 w-10",
  className = "",
}: {
  value: string;
  onChange: (hex: string) => void;
  name?: string;
  swatchClassName?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const id = useId();

  // Reflect external value changes (e.g. selecting another planner token).
  useEffect(() => {
    setText(value);
  }, [value]);

  function expand(hex: string): string | null {
    const m = hex.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(m)) return m.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(m)) {
      const [r, g, b] = m.slice(1);
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return null;
  }

  function onText(raw: string) {
    setText(raw);
    const hex = expand(raw);
    if (hex) onChange(hex);
  }

  function onBlur() {
    const hex = expand(text);
    if (hex) setText(hex);
    else setText(value); // revert invalid input
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${swatchClassName} shrink-0 cursor-pointer rounded-none border border-hair bg-base`}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onBlur}
        spellCheck={false}
        aria-label="Code couleur hexadécimal"
        className="w-[5.5rem] rounded-none border border-hair bg-base px-2 py-1 font-mono text-xs uppercase text-ink outline-none transition focus:border-violet"
      />
      {name && <input type="hidden" name={name} value={value} />}
    </span>
  );
}
