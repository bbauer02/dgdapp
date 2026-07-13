import type { EventRole } from "@prisma/client";

export interface RoleMeta {
  label: string;
  color: string; // faction/rank colour
  tier: number; // 1 = highest rank
  pips: number; // rank chevrons shown on the insignia
}

// Rank hierarchy, colours and insignia weight.
export const ROLE_META: Record<EventRole, RoleMeta> = {
  CHEVALIER: { label: "Chevalier", color: "#FFC53D", tier: 1, pips: 4 },
  SERGENT_MONTE: { label: "Sergent monté", color: "#7C4DFF", tier: 2, pips: 3 },
  SERGENT: { label: "Sergent", color: "#2D9CFF", tier: 3, pips: 2 },
  SOLDAT: { label: "Soldat", color: "#9A93B4", tier: 4, pips: 1 },
  INTENDANT: { label: "Intendant", color: "#FF9F1C", tier: 5, pips: 0 },
};

// Ordered high → low for menus and tables.
export const ROLE_ORDER: EventRole[] = [
  "CHEVALIER",
  "SERGENT_MONTE",
  "SERGENT",
  "SOLDAT",
  "INTENDANT",
];

// Default per-event fees (€). Copied into EventRolePrice when an event is set up.
export const DEFAULT_ROLE_FEES: Record<EventRole, number> = {
  CHEVALIER: 60,
  SERGENT_MONTE: 50,
  SERGENT: 40,
  SOLDAT: 25,
  INTENDANT: 30,
};

export function roleLabel(role: EventRole | null | undefined): string {
  return role ? ROLE_META[role].label : "—";
}
export function roleColor(role: EventRole | null | undefined): string {
  return role ? ROLE_META[role].color : "#6E6788";
}
