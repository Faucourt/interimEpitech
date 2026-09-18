import type { RawCommune } from './clean';

// API Découpage administratif de l'État : ouverte, sans clé, https://geo.api.gouv.fr
const BASE_URL = 'https://geo.api.gouv.fr/communes';
const FIELDS = 'fields=nom,codesPostaux,centre&format=json';

async function getJson(url: string): Promise<RawCommune[]> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`geo.api.gouv.fr a répondu ${response.status} pour ${url}`);
  }
  return (await response.json()) as RawCommune[];
}

/** Toutes les communes (≈ 35 000), Paris / Lyon / Marseille comptant chacune pour une seule. */
export function fetchCommunes(): Promise<RawCommune[]> {
  return getJson(`${BASE_URL}?${FIELDS}`);
}

/** Les 45 arrondissements municipaux de Paris, Lyon et Marseille, avec leur propre centre. */
export function fetchArrondissements(): Promise<RawCommune[]> {
  return getJson(`${BASE_URL}?type=arrondissement-municipal&${FIELDS}`);
}
