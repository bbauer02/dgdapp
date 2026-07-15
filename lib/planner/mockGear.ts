import type { GearDef } from "./types";

// Stand-in for "registered players' tents" for this event.
// Later: fetch CampGear joined through Registration for the event.
export const MOCK_GEAR: GearDef[] = [
  {
    id: "gear-michel",
    label: "Poivrière 4m",
    owner: "Michel D.",
    tentType: "POIVRIERE",
    shape: "ROUND",
    diameterM: 4,
    ropeZoneRadiusM: 1.2,
    color: "#b45309",
  },
  {
    id: "gear-sophie",
    label: "Poivrière 5m",
    owner: "Sophie L.",
    tentType: "POIVRIERE",
    shape: "ROUND",
    diameterM: 5,
    ropeZoneRadiusM: 1.5,
    color: "#a16207",
  },
  {
    id: "gear-jean",
    label: "Tente de soldat 2×3m",
    owner: "Jean P.",
    tentType: "SOLDAT",
    shape: "RECTANGULAR",
    widthM: 2,
    lengthM: 3,
    ropeZoneRadiusM: 0.8,
    color: "#4d7c0f",
  },
  {
    id: "gear-claire",
    label: "Pavillon 4×6m",
    owner: "Claire M.",
    tentType: "PAVILLON",
    shape: "RECTANGULAR",
    widthM: 4,
    lengthM: 6,
    ropeZoneRadiusM: 1.0,
    color: "#0f766e",
  },
];
