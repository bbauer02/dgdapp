import type { GearDef } from "./types";

// Stand-in for "registered players' tents" for this event.
// Later: fetch CampGear joined through Registration for the event.
export const MOCK_GEAR: GearDef[] = [
  {
    id: "gear-michel",
    label: "Tente cloche 4m",
    owner: "Michel D.",
    tentType: "BELL",
    shape: "ROUND",
    diameterM: 4,
    ropeZoneRadiusM: 1.2,
    color: "#b45309",
  },
  {
    id: "gear-sophie",
    label: "Tente cloche 5m",
    owner: "Sophie L.",
    tentType: "BELL",
    shape: "ROUND",
    diameterM: 5,
    ropeZoneRadiusM: 1.5,
    color: "#a16207",
  },
  {
    id: "gear-jean",
    label: "Canadienne 2×3m",
    owner: "Jean P.",
    tentType: "WEDGE",
    shape: "RECTANGULAR",
    widthM: 2,
    lengthM: 3,
    ropeZoneRadiusM: 0.8,
    color: "#4d7c0f",
  },
  {
    id: "gear-claire",
    label: "Marquise 4×6m",
    owner: "Claire M.",
    tentType: "MARQUEE",
    shape: "RECTANGULAR",
    widthM: 4,
    lengthM: 6,
    ropeZoneRadiusM: 1.0,
    color: "#0f766e",
  },
];
