"use client";

import { useActionState, useState } from "react";
import {
  addCampGear,
  deleteCampGear,
  type GearFormState,
} from "@/lib/actions/camp-gear";
import {
  DEFAULT_TENT_COLOR,
  TENT_TYPES,
  tentTypeLabel,
  type TentShapeValue,
} from "@/lib/camp-gear";
import TentTopView from "@/components/planner/TentTopView";
import ColorField from "@/components/ui/ColorField";

export interface GearItem {
  id: string;
  label: string;
  tentType: string;
  shape: TentShapeValue;
  diameterM: number | null;
  widthM: number | null;
  lengthM: number | null;
  footprintAreaM2: number | null;
  ropeZoneRadiusM: number;
  color: string | null;
  segments: string[];
}

const input =
  "rounded-none border border-hair bg-base px-3 py-2 text-ink outline-none transition focus:border-violet focus:shadow-neon-violet";

// Heraldic-ish palette used when adding a new pie segment ("rayon").
const SEGMENT_PALETTE = ["#9B1C31", "#E8E4DA", "#1F4E79", "#C9A227", "#2F6B3A", "#1A1A1A"];

function toNum(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function CampGearManager({
  userId,
  gear,
}: {
  userId: string;
  gear: GearItem[];
}) {
  const [state, formAction, pending] = useActionState<GearFormState, FormData>(
    addCampGear.bind(null, userId),
    undefined
  );

  // Controlled fields so the top-view preview updates live.
  const [shape, setShape] = useState<TentShapeValue>("ROUND");
  const [diameterM, setDiameterM] = useState("4");
  const [widthM, setWidthM] = useState("3");
  const [lengthM, setLengthM] = useState("4");
  const [ropeM, setRopeM] = useState("1.2");
  const [color, setColor] = useState(DEFAULT_TENT_COLOR);
  const [segments, setSegments] = useState<string[]>([]);

  const round = shape === "ROUND";

  function addSegment() {
    setSegments((s) => [...s, SEGMENT_PALETTE[s.length % SEGMENT_PALETTE.length]]);
  }
  function setSegment(i: number, c: string) {
    setSegments((s) => s.map((v, j) => (j === i ? c : v)));
  }
  function removeSegment(i: number) {
    setSegments((s) => s.filter((_, j) => j !== i));
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase text-white">
          Matériel de camp
        </h2>
        <p className="mt-1 font-nav text-xs text-ink-faint">
          Déclarez vos tentes (dimensions, cordage, livrée) : elles apparaissent sur
          votre profil et servent au plan de camp des événements.
        </p>
      </div>

      {/* Existing gear */}
      {gear.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {gear.map((g) => (
            <div key={g.id} className="panel relative flex gap-4 overflow-hidden p-4">
              <span
                className="absolute right-0 top-0 h-full w-1.5 -skew-x-[20deg]"
                style={{ background: g.color ?? DEFAULT_TENT_COLOR }}
              />
              <div className="shrink-0">
                <TentTopView
                  shape={g.shape}
                  diameterM={g.diameterM}
                  widthM={g.widthM}
                  lengthM={g.lengthM}
                  ropeZoneRadiusM={g.ropeZoneRadiusM}
                  color={g.color}
                  segments={g.segments}
                  size={84}
                />
              </div>
              <div className="min-w-0">
                <div className="stat-label">
                  {tentTypeLabel(g.tentType)} · {g.shape === "ROUND" ? "ronde" : "rectangulaire"}
                </div>
                <div className="mt-1 font-display text-lg font-bold uppercase text-white">
                  {g.label}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-nav text-sm text-ink-soft">
                  <span>
                    {g.shape === "ROUND"
                      ? `Ø ${g.diameterM ?? "—"} m`
                      : `${g.widthM ?? "—"} × ${g.lengthM ?? "—"} m`}
                  </span>
                  {g.footprintAreaM2 != null && <span>{g.footprintAreaM2} m²</span>}
                  <span>cordage {g.ropeZoneRadiusM} m</span>
                </div>
                <form action={deleteCampGear.bind(null, g.id)} className="mt-3">
                  <button
                    type="submit"
                    className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form action={formAction} className="panel flex flex-col gap-4 p-5">
        <p className="stat-label">Déclarer une tente</p>

        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="stat-label">Nom</span>
                <input name="label" required placeholder="Ex. Ma poivrière" className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="stat-label">Type</span>
                <select name="tentType" defaultValue="POIVRIERE" className={input}>
                  {TENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="stat-label">Forme</span>
                <select
                  name="shape"
                  value={shape}
                  onChange={(e) => setShape(e.target.value as TentShapeValue)}
                  className={input}
                >
                  <option value="ROUND">Ronde</option>
                  <option value="RECTANGULAR">Rectangulaire</option>
                </select>
              </label>

              {round ? (
                <label className="flex flex-col gap-1">
                  <span className="stat-label">Diamètre (m)</span>
                  <input
                    name="diameterM"
                    type="number"
                    min="0"
                    step="0.1"
                    value={diameterM}
                    onChange={(e) => setDiameterM(e.target.value)}
                    className={input}
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">Largeur (m)</span>
                    <input
                      name="widthM"
                      type="number"
                      min="0"
                      step="0.1"
                      value={widthM}
                      onChange={(e) => setWidthM(e.target.value)}
                      className={input}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">Longueur (m)</span>
                    <input
                      name="lengthM"
                      type="number"
                      min="0"
                      step="0.1"
                      value={lengthM}
                      onChange={(e) => setLengthM(e.target.value)}
                      className={input}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="stat-label">Zone de cordage (m)</span>
                <input
                  name="ropeZoneRadiusM"
                  type="number"
                  min="0"
                  step="0.1"
                  value={ropeM}
                  onChange={(e) => setRopeM(e.target.value)}
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="stat-label">Couleur de base</span>
                <ColorField name="color" value={color} onChange={setColor} swatchClassName="h-10 w-12" />
              </label>
            </div>

            {/* Segments / rayons — round tents only */}
            {round && (
              <div className="flex flex-col gap-2">
                <span className="stat-label">Rayons (livrée en quartiers)</span>
                <div className="flex flex-wrap items-center gap-2">
                  {segments.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded-none border border-hair p-1"
                    >
                      <ColorField
                        value={c}
                        onChange={(hex) => setSegment(i, hex)}
                        swatchClassName="h-7 w-8"
                      />
                      <button
                        type="button"
                        onClick={() => removeSegment(i)}
                        aria-label="Retirer le rayon"
                        className="px-1 text-ink-faint transition hover:text-danger"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSegment}
                    className="h-9 rounded-none border border-dashed border-hair px-3 font-nav text-[0.65rem] uppercase tracking-wider text-ink-soft transition hover:border-violet hover:text-white"
                  >
                    + Rayon
                  </button>
                </div>
                <p className="font-nav text-[0.65rem] text-ink-faint">
                  2 couleurs ou plus = quartiers égaux (poivrière rayée). Vide = disque uni.
                </p>
              </div>
            )}
          </div>

          {/* Live top-view preview */}
          <div className="flex flex-col items-center gap-2">
            <span className="stat-label">Aperçu (vue de dessus)</span>
            <div className="grid place-items-center rounded-none border border-hair bg-[#1B1826] p-3">
              <TentTopView
                shape={shape}
                diameterM={toNum(diameterM)}
                widthM={toNum(widthM)}
                lengthM={toNum(lengthM)}
                ropeZoneRadiusM={toNum(ropeM) ?? 0}
                color={color}
                segments={round ? segments : []}
                size={150}
              />
            </div>
          </div>
        </div>

        <input
          type="hidden"
          name="segments"
          value={JSON.stringify(round ? segments : [])}
        />

        {state?.error && (
          <p className="badge badge-no justify-center py-2">{state.error}</p>
        )}

        <div>
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? "…" : "Ajouter la tente"}
          </button>
        </div>
      </form>
    </section>
  );
}
