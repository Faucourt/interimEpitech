const frenchNumber = new Intl.NumberFormat('fr-FR');

/** Formate un entier à la française (« 35 493 ») pour les rapports de progression. */
export function n(value: number): string {
  return frenchNumber.format(value);
}

/** Pourcentage lisible à partir d'un ratio 0-1 (« 42 % »). */
export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export function log(message = ''): void {
  console.log(message);
}
