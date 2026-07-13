"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload-client";
import { useStrayDropGuard } from "@/components/ui/drop-guard";

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/** A dossier piece: image thumbnail, or a PDF chip. Opens in a new tab. */
export function FilePiece({ url, index }: { url: string; index: number }) {
  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-20 w-20 flex-col items-center justify-center gap-1 border border-hair bg-base font-nav text-[0.6rem] uppercase tracking-wider text-ink-soft transition hover:border-lime hover:text-lime"
        title={url}
      >
        <span className="text-xl">📄</span>
        PDF {index + 1}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Pièce ${index + 1} du dossier`}
        className="h-20 w-20 border border-hair object-cover transition hover:border-lime"
      />
    </a>
  );
}

/**
 * Drag-and-drop upload field for dossier pieces (images + PDF).
 * Files are uploaded to /api/upload on drop; the resulting URLs are submitted
 * through a hidden textarea `name` as one URL per line — the exact format the
 * existing server actions (`toUrlList`, profile galleries) already parse.
 * URLs can still be added by hand for externally-hosted pieces.
 */
export default function FileDropField({
  name,
  label,
  defaultUrls = [],
}: {
  name: string;
  label: string;
  defaultUrls?: string[];
}) {
  const [urls, setUrls] = useState<string[]>(defaultUrls.filter(Boolean));
  const [manualUrl, setManualUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useStrayDropGuard();

  async function addFiles(files: FileList | File[] | null | undefined) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        const res = await uploadFile(file);
        setUrls((cur) => [...cur, res.url]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Échec de l'upload");
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addManual() {
    const u = manualUrl.trim();
    if (!u) return;
    setUrls((cur) => [...cur, u]);
    setManualUrl("");
  }

  return (
    <div data-image-drop className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>

      {/* Value submitted to the existing actions: one URL per line.
          Emptiness is validated server-side (a hidden field can't surface
          native constraint validation). */}
      <textarea name={name} value={urls.join("\n")} readOnly hidden />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Ignore les dragleave vers un enfant de la zone (anti-flicker).
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-[6rem] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed px-4 py-5 text-center transition ${
          dragging
            ? "border-lime bg-lime/5 text-lime"
            : "border-hair text-ink-soft hover:border-violet hover:text-white"
        }`}
      >
        <span className="font-nav text-xs font-semibold uppercase tracking-[0.12em]">
          {busy ? "Envoi en cours…" : "Glissez-déposez vos images ou PDF ici"}
        </span>
        <span className="font-nav text-[0.65rem] text-ink-faint">
          ou cliquez pour parcourir — 8 Mo max par fichier
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />

      {urls.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} className="group relative">
              <FilePiece url={url} index={i} />
              <button
                type="button"
                onClick={() => setUrls((cur) => cur.filter((_, j) => j !== i))}
                aria-label="Retirer la pièce"
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-danger/60 bg-base text-[0.6rem] text-danger group-hover:flex"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1 flex gap-2">
        <input
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="…ou ajouter une URL externe"
          className="min-w-0 flex-1 rounded-none border border-hair bg-base px-3 py-1.5 font-nav text-xs text-ink outline-none transition focus:border-violet"
        />
        <button
          type="button"
          onClick={addManual}
          className="shrink-0 border border-hair px-3 font-nav text-[0.65rem] uppercase tracking-wider text-ink-soft transition hover:border-violet hover:text-white"
        >
          Ajouter
        </button>
      </div>

      {error && <p className="font-nav text-xs text-danger">{error}</p>}
    </div>
  );
}
