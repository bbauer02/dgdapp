// Planner domain types — deliberately mirror the Prisma `CampGear` / `CampToken`
// models so swapping mock data for real DB records is a straight substitution.

export type TentShape = "ROUND" | "RECTANGULAR";

export interface PieSegment {
  color: string; // segments are always drawn as equal parts (360° / count)
}

/** A tent/equipment a registered player declared — the source of a token. */
export interface GearDef {
  id: string;
  label: string;
  owner: string; // player display name, for the toolbox list
  tentType: string;
  shape: TentShape;
  diameterM?: number; // ROUND
  widthM?: number; // RECTANGULAR
  lengthM?: number; // RECTANGULAR
  ropeZoneRadiusM: number; // buffer margin
  color: string;
}

/** A shape placed on the canvas. Position is the token CENTER, in meters. */
export interface PlacedToken {
  id: string;
  gearId?: string; // null => free-form geometric token
  label: string;
  shape: TentShape;
  xM: number;
  yM: number;
  rotation: number; // degrees
  diameterM?: number;
  widthM?: number;
  lengthM?: number;
  ropeZoneRadiusM: number;
  showRopeZone: boolean;
  color: string;
  segments?: PieSegment[]; // optional pie-chart fill (round tokens)
}

export interface LayoutConfig {
  widthM: number;
  heightM: number;
  pixelsPerMeter: number;
}

/** Total ground footprint in m² for display. */
export function footprintM2(t: Pick<PlacedToken, "shape" | "diameterM" | "widthM" | "lengthM">): number {
  if (t.shape === "ROUND" && t.diameterM) {
    const r = t.diameterM / 2;
    return Math.PI * r * r;
  }
  if (t.shape === "RECTANGULAR" && t.widthM && t.lengthM) {
    return t.widthM * t.lengthM;
  }
  return 0;
}
