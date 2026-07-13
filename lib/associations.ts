/**
 * Normalize an association name for the strict-uniqueness constraint.
 * "  Asso   X " and "asso x" both collapse to "asso x", so they cannot
 * both exist in the DB (see Association.nameNormalized @unique).
 */
export function normalizeAssociationName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD") // split accents from letters
    .replace(/[̀-ͯ]/g, "") // drop the accent marks
    .replace(/\s+/g, " "); // collapse internal whitespace
}
