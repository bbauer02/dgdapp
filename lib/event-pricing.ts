// Event pricing is driven entirely by its formules (packages): there is no
// separate "base price". This derives the vitrine label from the package prices.

/** "À partir de X €" from the cheapest formule, or "Gratuit" when none/free. */
export function eventPriceLabel(prices: number[]): string {
  const positive = prices.filter((p) => p > 0);
  if (positive.length === 0) return "Gratuit";
  const min = Math.min(...positive);
  return `À partir de ${min.toFixed(2)} €`;
}
