"use client";

import { useMemo, useState } from "react";
import CampCanvas from "./CampCanvas";
import { MOCK_GEAR } from "@/lib/planner/mockGear";
import { saveCampLayout } from "@/lib/actions/planner";
import {
  footprintM2,
  type GearDef,
  type LayoutConfig,
  type PieSegment,
  type PlacedToken,
  type TentShape,
} from "@/lib/planner/types";

let tokenSeq = 0;
const nextId = () => `tok-${++tokenSeq}-${tokenSeq * 7}`; // deterministic, no Math.random

function tokenFromGear(g: GearDef, xM: number, yM: number): PlacedToken {
  return {
    id: nextId(),
    gearId: g.id,
    label: `${g.label} — ${g.owner}`,
    shape: g.shape,
    xM,
    yM,
    rotation: 0,
    diameterM: g.diameterM,
    widthM: g.widthM,
    lengthM: g.lengthM,
    ropeZoneRadiusM: g.ropeZoneRadiusM,
    showRopeZone: false,
    color: g.color,
  };
}

const PIE_PRESET: PieSegment[] = [
  { color: "#dc2626" },
  { color: "#2563eb" },
  { color: "#eab308" },
];

// Global display scale bounds (pixels per meter). 20 px/m = 100% zoom.
const SCALE_MIN = 6;
const SCALE_MAX = 50;

// Compact dark input idiom (Nécromant design system).
const INPUT_CLS =
  "rounded-none border border-hair bg-base px-2 py-1 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";
// Small stepper / ghost buttons.
const STEP_BTN =
  "shrink-0 rounded-none border border-hair bg-base text-ink-soft transition hover:border-violet hover:text-white";

export interface CampPlannerProps {
  /** When set, the plan is persisted to this event's CampLayout. */
  eventId?: string;
  eventTitle?: string;
  /** Saved layout to reopen (falls back to a blank 20×30 terrain). */
  initialLayout?: LayoutConfig;
  /** Previously placed tokens to restore. */
  initialTokens?: PlacedToken[];
  /** Tents declared by this event's registered players (toolbox source). */
  gear?: GearDef[];
}

export default function CampPlanner({
  eventId,
  eventTitle,
  initialLayout,
  initialTokens,
  gear = MOCK_GEAR,
}: CampPlannerProps = {}) {
  const [layout, setLayout] = useState<LayoutConfig>(
    initialLayout ?? { widthM: 20, heightM: 30, pixelsPerMeter: 20 }
  );
  const [tokens, setTokens] = useState<PlacedToken[]>(initialTokens ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- Persistence ---
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  async function handleSave() {
    if (!eventId || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await saveCampLayout(eventId, {
        widthM: layout.widthM,
        heightM: layout.heightM,
        pixelsPerMeter: layout.pixelsPerMeter,
        tokens,
      });
      setSaveMsg(
        "ok" in res
          ? { ok: true, text: `Plan enregistré · ${tokens.length} élément(s)` }
          : { ok: false, text: res.error }
      );
    } catch {
      setSaveMsg({ ok: false, text: "Échec de l'enregistrement" });
    } finally {
      setSaving(false);
    }
  }

  // Generic-shape tool form state
  const [gShape, setGShape] = useState<TentShape>("ROUND");
  const [gDiameter, setGDiameter] = useState(3);
  const [gWidth, setGWidth] = useState(3);
  const [gLength, setGLength] = useState(4);
  const [gRope, setGRope] = useState(1);
  const [gColor, setGColor] = useState("#7c3aed");
  const [gPie, setGPie] = useState(false);

  const selected = useMemo(
    () => tokens.find((t) => t.id === selectedId) ?? null,
    [tokens, selectedId]
  );

  function setScale(px: number) {
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(px)));
    setLayout((prev) => ({ ...prev, pixelsPerMeter: clamped }));
  }

  function addFromGear(gearId: string, xM: number, yM: number) {
    const g = gear.find((x) => x.id === gearId);
    if (!g) return;
    const tok = tokenFromGear(g, xM, yM);
    setTokens((prev) => [...prev, tok]);
    setSelectedId(tok.id);
  }

  function addGeneric() {
    const isRound = gShape === "ROUND";
    const tok: PlacedToken = {
      id: nextId(),
      label: isRound ? `Cercle ${gDiameter}m` : `Rectangle ${gWidth}×${gLength}m`,
      shape: gShape,
      xM: layout.widthM / 2,
      yM: layout.heightM / 2,
      rotation: 0,
      diameterM: isRound ? gDiameter : undefined,
      widthM: isRound ? undefined : gWidth,
      lengthM: isRound ? undefined : gLength,
      ropeZoneRadiusM: gRope,
      showRopeZone: gRope > 0,
      color: gColor,
      segments: isRound && gPie ? PIE_PRESET : undefined,
    };
    setTokens((prev) => [...prev, tok]);
    setSelectedId(tok.id);
  }

  function patch(id: string, p: Partial<PlacedToken>) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function move(id: string, xM: number, yM: number) {
    patch(id, { xM, yM });
  }
  function toggleRope(id: string) {
    setTokens((prev) =>
      prev.map((t) => (t.id === id ? { ...t, showRopeZone: !t.showRopeZone } : t))
    );
  }
  function remove(id: string) {
    setTokens((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // --- Pie segments (round tokens) ---
  const SEG_PALETTE = ["#dc2626", "#2563eb", "#eab308", "#16a34a", "#9333ea", "#ea580c"];
  function updateSegments(id: string, segments: PieSegment[] | undefined) {
    patch(id, { segments });
  }
  function addSegment(t: PlacedToken) {
    const segs = t.segments ?? [];
    const color = SEG_PALETTE[segs.length % SEG_PALETTE.length];
    updateSegments(t.id, [...segs, { color }]);
  }
  function patchSegment(t: PlacedToken, i: number, p: Partial<PieSegment>) {
    const segs = (t.segments ?? []).map((s, idx) => (idx === i ? { ...s, ...p } : s));
    updateSegments(t.id, segs);
  }
  function removeSegment(t: PlacedToken, i: number) {
    const segs = (t.segments ?? []).filter((_, idx) => idx !== i);
    updateSegments(t.id, segs.length ? segs : undefined);
  }

  return (
    <div className="flex h-screen w-full bg-base text-ink">
      {/* ---------------- Toolbox sidebar ---------------- */}
      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-hair bg-surface p-4">
        <div>
          <p className="kicker">Plan de camp</p>
          <h2 className="font-display text-lg font-bold uppercase text-white">
            {eventTitle ?? "Camp Planner"}
          </h2>
          <p className="text-xs text-ink-faint">
            Glissez une tente sur le plan. 1 m = {layout.pixelsPerMeter} px.
          </p>
        </div>

        {/* Persistence — only when scoped to an event */}
        {eventId && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary !py-2.5 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Enregistrer le plan"}
            </button>
            {saveMsg && (
              <p
                className={`badge justify-center py-1.5 ${
                  saveMsg.ok ? "badge-ok" : "badge-no"
                }`}
              >
                {saveMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Map settings */}
        <section className="rounded-none border border-hair bg-surface-raised p-3">
          <h3 className="mb-2 font-display text-sm font-bold uppercase text-white">Terrain</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">
              Largeur (m)
              <input
                type="number"
                min={5}
                value={layout.widthM}
                onChange={(e) => setLayout({ ...layout, widthM: +e.target.value || 1 })}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              Hauteur (m)
              <input
                type="number"
                min={5}
                value={layout.heightM}
                onChange={(e) => setLayout({ ...layout, heightM: +e.target.value || 1 })}
                className={INPUT_CLS}
              />
            </label>
          </div>

          {/* Global scale / zoom */}
          <div className="mt-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="stat-label">Échelle</span>
              <span className="tabular-nums text-ink-faint">
                1 m = {layout.pixelsPerMeter} px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(layout.pixelsPerMeter - 2)}
                className={`h-7 w-7 text-base leading-none ${STEP_BTN}`}
                title="Dézoomer"
              >
                −
              </button>
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={1}
                value={layout.pixelsPerMeter}
                onChange={(e) => setScale(+e.target.value)}
                className="flex-1"
              />
              <button
                onClick={() => setScale(layout.pixelsPerMeter + 2)}
                className={`h-7 w-7 text-base leading-none ${STEP_BTN}`}
                title="Zoomer"
              >
                +
              </button>
              <button
                onClick={() => setScale(20)}
                className={`px-2 py-1 ${STEP_BTN}`}
                title="Réinitialiser l'échelle"
              >
                100%
              </button>
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              Zoom {Math.round((layout.pixelsPerMeter / 20) * 100)}% — n'affecte que
              l'affichage, pas les dimensions réelles.
            </p>
          </div>
        </section>

        {/* Registered players' tents */}
        <section>
          <h3 className="mb-2 font-display text-sm font-bold uppercase text-white">Tentes déclarées</h3>
          {gear.length === 0 && (
            <p className="text-xs text-ink-faint">
              Aucune tente déclarée par les inscrits. Utilisez les formes
              personnalisées ci-dessous.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {gear.map((g) => (
              <li
                key={g.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/gear", g.id)}
                className="flex cursor-grab items-center gap-3 rounded-none border border-hair bg-surface-raised p-2 transition hover:border-violet active:cursor-grabbing"
                title="Glisser vers le plan"
              >
                <span
                  className="inline-block shrink-0 border border-hair"
                  style={{
                    background: g.color,
                    opacity: 0.8,
                    width: g.shape === "ROUND" ? 22 : (g.widthM ?? 2) * 5,
                    height: g.shape === "ROUND" ? 22 : (g.lengthM ?? 2) * 5,
                    borderRadius: g.shape === "ROUND" ? "9999px" : 3,
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{g.label}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {g.owner} ·{" "}
                    {g.shape === "ROUND"
                      ? `Ø${g.diameterM}m`
                      : `${g.widthM}×${g.lengthM}m`}{" "}
                    · cordage {g.ropeZoneRadiusM}m
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Generic geometric tool */}
        <section className="rounded-none border border-hair bg-surface-raised p-3">
          <h3 className="mb-2 font-display text-sm font-bold uppercase text-white">Forme personnalisée</h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex gap-2">
              <button
                onClick={() => setGShape("ROUND")}
                className={`flex-1 rounded-none border px-2 py-1 font-nav uppercase tracking-wider transition ${
                  gShape === "ROUND"
                    ? "border-violet bg-violet text-white shadow-neon-violet"
                    : "border-hair bg-base text-ink-soft hover:border-violet hover:text-white"
                }`}
              >
                Cercle
              </button>
              <button
                onClick={() => setGShape("RECTANGULAR")}
                className={`flex-1 rounded-none border px-2 py-1 font-nav uppercase tracking-wider transition ${
                  gShape === "RECTANGULAR"
                    ? "border-violet bg-violet text-white shadow-neon-violet"
                    : "border-hair bg-base text-ink-soft hover:border-violet hover:text-white"
                }`}
              >
                Rectangle
              </button>
            </div>

            {gShape === "ROUND" ? (
              <label className="flex flex-col gap-1">
                Diamètre (m)
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={gDiameter}
                  onChange={(e) => setGDiameter(+e.target.value || 1)}
                  className={INPUT_CLS}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  Largeur (m)
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={gWidth}
                    onChange={(e) => setGWidth(+e.target.value || 1)}
                    className={INPUT_CLS}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Longueur (m)
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={gLength}
                    onChange={(e) => setGLength(+e.target.value || 1)}
                    className={INPUT_CLS}
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1">
              Marge cordage (m)
              <input
                type="number"
                min={0}
                step={0.1}
                value={gRope}
                onChange={(e) => setGRope(+e.target.value || 0)}
                className={INPUT_CLS}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Couleur</span>
              <input
                type="color"
                value={gColor}
                onChange={(e) => setGColor(e.target.value)}
                className="h-7 w-12 rounded-none border border-hair bg-base"
              />
            </label>

            {gShape === "ROUND" && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gPie}
                  onChange={(e) => setGPie(e.target.checked)}
                />
                Segments (camembert)
              </label>
            )}

            <button
              onClick={addGeneric}
              className="mt-1 rounded-none bg-lime px-2 py-1.5 font-nav font-bold uppercase tracking-wider text-base transition hover:shadow-neon-lime"
            >
              + Ajouter au plan
            </button>
          </div>
        </section>
      </aside>

      {/* ---------------- Canvas ---------------- */}
      <main className="flex-1 overflow-auto p-4">
        <CampCanvas
          layout={layout}
          tokens={tokens}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={move}
          onToggleRope={toggleRope}
          onDropGear={addFromGear}
        />
      </main>

      {/* ---------------- Properties panel ---------------- */}
      <aside className="w-72 shrink-0 overflow-y-auto border-l border-hair bg-surface p-4">
        <h3 className="font-display text-sm font-bold uppercase text-white">Propriétés</h3>
        {!selected ? (
          <p className="mt-2 text-xs text-ink-faint">
            Sélectionnez un élément sur le plan.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3 text-xs">
            <label className="flex flex-col gap-1">
              Nom
              <input
                value={selected.label}
                onChange={(e) => patch(selected.id, { label: e.target.value })}
                className={INPUT_CLS}
              />
            </label>

            {/* Editable dimensions — token rescales live to match */}
            {selected.shape === "ROUND" ? (
              <label className="flex flex-col gap-1">
                Diamètre (m)
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={selected.diameterM ?? 0}
                  onChange={(e) =>
                    patch(selected.id, { diameterM: +e.target.value || 0.5 })
                  }
                  className={INPUT_CLS}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  Largeur (m)
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={selected.widthM ?? 0}
                    onChange={(e) =>
                      patch(selected.id, { widthM: +e.target.value || 0.5 })
                    }
                    className={INPUT_CLS}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Longueur (m)
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={selected.lengthM ?? 0}
                    onChange={(e) =>
                      patch(selected.id, { lengthM: +e.target.value || 0.5 })
                    }
                    className={INPUT_CLS}
                  />
                </label>
              </div>
            )}

            <div className="rounded-none border border-hair bg-base p-2 text-ink-soft">
              Emprise ≈ {footprintM2(selected).toFixed(1)} m²
            </div>

            <label className="flex items-center justify-between">
              Zone de cordage
              <button
                onClick={() => toggleRope(selected.id)}
                className={`relative h-6 w-11 rounded-full transition ${
                  selected.showRopeZone ? "bg-violet shadow-neon-violet" : "bg-hair"
                }`}
                aria-pressed={selected.showRopeZone}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    selected.showRopeZone ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </label>

            <label className="flex flex-col gap-1">
              Rayon cordage (m)
              <input
                type="number"
                min={0}
                step={0.1}
                value={selected.ropeZoneRadiusM}
                onChange={(e) =>
                  patch(selected.id, { ropeZoneRadiusM: +e.target.value || 0 })
                }
                className={INPUT_CLS}
              />
            </label>

            <label className="flex flex-col gap-1">
              Rotation (°)
              <input
                type="range"
                min={0}
                max={359}
                value={selected.rotation}
                onChange={(e) => patch(selected.id, { rotation: +e.target.value })}
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Couleur</span>
              <input
                type="color"
                value={selected.color}
                onChange={(e) => patch(selected.id, { color: e.target.value })}
                className="h-7 w-12 rounded-none border border-hair bg-base"
              />
            </label>

            {/* Per-segment colours (round tokens only) */}
            {selected.shape === "ROUND" && (
              <div className="rounded-none border border-hair bg-base p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-ink">Segments (camembert)</span>
                  {selected.segments && selected.segments.length > 0 && (
                    <button
                      onClick={() => updateSegments(selected.id, undefined)}
                      className="text-ink-faint transition hover:text-danger"
                      title="Retirer les segments"
                    >
                      Retirer
                    </button>
                  )}
                </div>

                {!selected.segments || selected.segments.length === 0 ? (
                  <button
                    onClick={() => addSegment(selected)}
                    className="w-full rounded-none border border-dashed border-hair py-1.5 text-ink-soft transition hover:border-violet hover:text-white"
                  >
                    + Diviser en segments colorés
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selected.segments.map((seg, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={seg.color}
                          onChange={(e) =>
                            patchSegment(selected, i, { color: e.target.value })
                          }
                          className="h-7 w-9 shrink-0 rounded-none border border-hair bg-base"
                          title="Couleur du segment"
                        />
                        <span className="flex-1 text-ink-faint">
                          Segment {i + 1} · {(360 / selected.segments!.length).toFixed(0)}°
                        </span>
                        <button
                          onClick={() => removeSegment(selected, i)}
                          className="shrink-0 px-1 text-ink-faint transition hover:text-danger"
                          title="Supprimer le segment"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addSegment(selected)}
                      className="rounded-none border border-dashed border-hair py-1 text-ink-soft transition hover:border-violet hover:text-white"
                    >
                      + Ajouter un segment
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => remove(selected.id)}
              className="mt-2 rounded-none border border-danger/50 bg-danger/10 px-2 py-1.5 font-nav font-bold uppercase tracking-wider text-danger transition hover:bg-danger/20"
            >
              Supprimer
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
