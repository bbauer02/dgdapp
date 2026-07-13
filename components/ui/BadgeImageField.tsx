"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/upload-client";
import { useStrayDropGuard } from "@/components/ui/drop-guard";

// Les badges sont affichés en petits carrés (h-14/h-16, object-cover) :
// on stocke un carré de 256 px, net sur écrans retina et léger sur disque.
const BADGE_SIZE = 256;

// Types acceptés tels quels par /api/upload — tout autre format image
// (BMP, AVIF…) est converti en PNG côté client plutôt que rejeté en 415.
const SERVER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

/**
 * Recadre (carré centré) et réduit l'image à BADGE_SIZE si elle est plus
 * grande. SVG et GIF sont conservés tels quels : les rastériser perdrait
 * le vectoriel / l'animation.
 */
async function toBadgeFile(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  try {
    const tooBig = Math.max(bitmap.width, bitmap.height) > BADGE_SIZE;
    if (!tooBig && SERVER_TYPES.has(file.type)) return file;

    const side = Math.min(bitmap.width, bitmap.height);
    const target = tooBig ? BADGE_SIZE : side;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      target,
      target
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return file;
    return new File([blob], "badge.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}

/**
 * Champ image unique pour l'icône d'un badge : glisser-déposer, coller
 * (Ctrl+V n'importe où dans le formulaire) ou parcourir. L'image est
 * recadrée/réduite au format badge côté client, uploadée vers /api/upload,
 * et l'URL obtenue est soumise via un input caché `name` — les server
 * actions existantes restent inchangées.
 */
export default function BadgeImageField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  async function setImage(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Seules les images sont acceptées pour l'icône.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const badge = await toBadgeFile(file);
      const res = await uploadFile(badge);
      setUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const setImageRef = useRef(setImage);
  setImageRef.current = setImage;

  // Ctrl+V fonctionne partout dans le formulaire parent, pas seulement dans
  // la zone. Si le presse-papier contient AUSSI du texte et que l'utilisateur
  // colle dans un champ texte, on laisse le collage de texte normal.
  useEffect(() => {
    const form: HTMLElement | null =
      rootRef.current?.closest("form") ?? rootRef.current;
    if (!form) return;
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;
      const image = Array.from(data.items).find((i) =>
        i.type.startsWith("image/")
      );
      if (!image) return;
      const target = e.target as HTMLElement | null;
      const isTextField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (isTextField && data.types.includes("text/plain")) return;
      e.preventDefault();
      void setImageRef.current(image.getAsFile());
    };
    form.addEventListener("paste", onPaste);
    return () => form.removeEventListener("paste", onPaste);
  }, []);

  // Pendant l'envoi, bloque la soumission du formulaire : sans ce garde-fou
  // le haut fait serait créé sans icône, silencieusement.
  useEffect(() => {
    if (!busy) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      setError("L'image est en cours d'envoi — réessayez dans un instant.");
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [busy]);

  useStrayDropGuard();

  return (
    <div ref={rootRef} data-image-drop className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="flex items-start gap-3">
        {/* Aperçu au format badge (même rendu que les pages publiques) */}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="h-16 w-16 shrink-0 border border-hair bg-base object-cover"
          />
        ) : null}

        <div
          role="button"
          tabIndex={0}
          aria-label={`${label} — glisser-déposer, coller ou parcourir`}
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
            void setImage(e.dataTransfer.files[0]);
          }}
          className={`flex min-h-[4rem] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 border border-dashed px-4 py-3 text-center outline-none transition focus-visible:border-violet focus-visible:shadow-neon-violet ${
            dragging
              ? "border-lime bg-lime/5 text-lime"
              : "border-hair text-ink-soft hover:border-violet hover:text-white"
          }`}
        >
          <span
            className={`font-nav text-xs font-semibold uppercase tracking-[0.12em] ${busy ? "animate-pulse" : ""}`}
          >
            {busy
              ? "Envoi en cours…"
              : url
                ? "Remplacer l'image"
                : "Glissez-déposez ou collez une image"}
          </span>
          <span className="font-nav text-[0.65rem] text-ink-faint">
            cliquez pour parcourir · Ctrl+V pour coller — réduite au format badge
          </span>
        </div>
      </div>

      {url && (
        <button
          type="button"
          onClick={() => {
            setUrl("");
            setError(null);
          }}
          className="self-start font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
        >
          Retirer l'image
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void setImage(e.target.files?.[0])}
      />

      {error && <p className="font-nav text-xs text-danger">{error}</p>}
    </div>
  );
}
