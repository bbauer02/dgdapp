"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Circular crop editor (home-made, no external dependency).
 * The user drags to reposition and zooms with the slider / wheel; on confirm
 * the visible disc is rendered to a square canvas and returned as a JPEG blob.
 */

const VIEW = 260; // viewport size in CSS px
const OUTPUT = 512; // exported image size in px
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

export default function ImageCropModal({
  src,
  shape = "circle",
  onCancel,
  onConfirm,
}: {
  src: string;
  shape?: "circle" | "square";
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const baseScale = useRef(1);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Keep the image fully covering the viewport at every zoom level.
  const clamp = useCallback(
    (x: number, y: number, scale: number, image: HTMLImageElement): Offset => {
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      return {
        x: Math.min(0, Math.max(VIEW - w, x)),
        y: Math.min(0, Math.max(VIEW - h, y)),
      };
    },
    []
  );

  // Load the source, then center it "cover"-style in the viewport.
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const base = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
      baseScale.current = base;
      setImg(image);
      setZoom(1);
      setOffset({
        x: (VIEW - image.naturalWidth * base) / 2,
        y: (VIEW - image.naturalHeight * base) / 2,
      });
    };
    image.src = src;
  }, [src]);

  const scale = baseScale.current * zoom;

  function applyZoom(next: number) {
    if (!img) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const oldScale = baseScale.current * zoom;
    const newScale = baseScale.current * z;
    // Keep the viewport center anchored on the same image point.
    const cx = (VIEW / 2 - offset.x) / oldScale;
    const cy = (VIEW / 2 - offset.y) / oldScale;
    setZoom(z);
    setOffset(clamp(VIEW / 2 - cx * newScale, VIEW / 2 - cy * newScale, newScale, img));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !img) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clamp(nx, ny, scale, img));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    if (!img) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }
    // Source rectangle = the square currently framed by the viewport.
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = VIEW / scale;
    ctx.fillStyle = "#12101a";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="panel w-full max-w-sm p-6">
        <p className="stat-label mb-4 text-center">Recadrer l'image</p>

        <div className="flex justify-center">
          <div
            className={`relative overflow-hidden border-2 border-lime bg-base ${
              shape === "circle" ? "rounded-full" : "rounded-none"
            }`}
            style={{ width: VIEW, height: VIEW, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => applyZoom(zoom - e.deltaY * 0.001)}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: img.naturalWidth * scale,
                  height: img.naturalHeight * scale,
                  left: offset.x,
                  top: offset.y,
                }}
              />
            ) : (
              <div className="grid h-full place-items-center font-nav text-xs uppercase tracking-wider text-ink-faint">
                Chargement…
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="font-nav text-xs uppercase tracking-wider text-ink-faint">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="w-full accent-lime"
            disabled={!img}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!img || saving}
            className="btn btn-lime disabled:opacity-60"
          >
            {saving ? "…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
