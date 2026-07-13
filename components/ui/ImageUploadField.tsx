"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload-client";

/**
 * Image upload as a form field: uploads to /api/upload on selection, shows a
 * preview, and submits the stored URL through a hidden input `name`.
 * `aspect` tunes the preview box (logo = square, bannière = wide).
 */
export default function ImageUploadField({
  name,
  label,
  defaultValue,
  aspect = "square",
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  aspect?: "square" | "banner";
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadFile(file);
      setUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const previewClass =
    aspect === "banner" ? "h-24 w-full object-cover" : "h-24 w-24 object-cover";

  return (
    <div className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className={`${previewClass} border border-hair bg-base`} />
        ) : (
          <div
            className={`${
              aspect === "banner" ? "h-24 w-full" : "h-24 w-24"
            } grid place-items-center border border-dashed border-hair font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint`}
          >
            Aucune image
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="btn btn-ghost !px-4 !py-1.5 disabled:opacity-60"
          >
            {busy ? "…" : url ? "Remplacer" : "Uploader"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      {error && <p className="font-nav text-xs text-danger">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </div>
  );
}
