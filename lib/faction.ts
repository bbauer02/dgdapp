// Deterministic faction accent for an association (or any seed string),
// so a given association always renders in the same neon colour.
const FACTION = ["#7C4DFF", "#A3FF12", "#2D9CFF", "#FF4D4D", "#FFC53D"];

export function factionColor(seed: string | null | undefined): string {
  if (!seed) return "#7C4DFF";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FACTION[h % FACTION.length];
}

export function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
