// Data-driven navigation. Today it's a static config; because it's a plain
// data structure it can later be sourced from the DB / CMS without touching
// the components that render it.
export interface NavChild {
  label: string;
  href: string;
}
export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

// Un libellé par destination, une destination par entrée — pas de doublons.
export const MAIN_NAV: NavItem[] = [
  { label: "Accueil", href: "/" },
  { label: "Événements", href: "/events" },
  { label: "Associations", href: "/associations" },
  { label: "Participants", href: "/players" },
];
