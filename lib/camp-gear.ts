// Shared camp-gear helpers (safe to import from both client and server).

// Default tent canvas colour: natural linen / écru (toile de lin).
export const DEFAULT_TENT_COLOR = "#E4D5B7";

export const TENT_TYPES = [
  { value: "POIVRIERE", label: "Poivrière" },
  { value: "SOLDAT", label: "Soldat" },
  { value: "PAVILLON", label: "Pavillon" },
] as const;

export type TentTypeValue = (typeof TENT_TYPES)[number]["value"];
export type TentShapeValue = "ROUND" | "RECTANGULAR";

export function tentTypeLabel(value: string): string {
  return TENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Ground footprint in m² (π·r² for round, w·l for rectangular). */
export function tentFootprintM2(
  shape: TentShapeValue,
  diameterM?: number,
  widthM?: number,
  lengthM?: number
): number | null {
  if (shape === "ROUND" && diameterM) {
    const r = diameterM / 2;
    return Math.round(Math.PI * r * r * 100) / 100;
  }
  if (shape === "RECTANGULAR" && widthM && lengthM) {
    return Math.round(widthM * lengthM * 100) / 100;
  }
  return null;
}
