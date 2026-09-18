/**
 * Nettoyage des communes issues de geo.api.gouv.fr — fonctions pures, sans I/O.
 *
 * Transformations appliquées (exigence « nettoyer et reformater » du sujet) :
 *  - éclatement : une commune à plusieurs codes postaux devient une ligne par couple (code postal, nom) ;
 *  - lieux : le centre GeoJSON [longitude, latitude] est converti en colonnes latitude / longitude ;
 *  - libellés : espaces normalisés, noms tout en majuscules remis en casse française ;
 *  - codes postaux : recadrés sur 5 chiffres, invalides écartés ;
 *  - arrondissements municipaux prioritaires sur la commune globale (Paris, Lyon, Marseille) ;
 *  - dédoublonnage sur la clé primaire (code_postal, nom).
 */

/** Forme brute renvoyée par geo.api.gouv.fr avec `fields=nom,codesPostaux,centre`. */
export interface RawCommune {
  nom?: string | null;
  /** Code INSEE, repris uniquement dans les messages de rejet. */
  code?: string;
  codesPostaux?: Array<string | number> | null;
  /** GeoJSON Point : `coordinates` = [longitude, latitude], dans cet ordre. */
  centre?: { type?: string; coordinates?: unknown } | null;
}

/** Une ligne de la table `communes` (clé primaire composite code_postal + nom). */
export interface CommuneRow {
  code_postal: string;
  nom: string;
  latitude: number;
  longitude: number;
}

export type RejectReason = 'sans_nom' | 'sans_code_postal' | 'sans_coordonnees' | 'coordonnees_invalides';

export interface RejectedCommune {
  code?: string;
  nom: string;
  reason: RejectReason;
}

export interface CleanedCommune {
  rows: CommuneRow[];
  reason: RejectReason | null;
}

export interface CleanReport {
  rows: CommuneRow[];
  /** Couples (code postal, commune) produits par l'éclatement, avant priorité et dédoublonnage. */
  exploded: number;
  overriddenByArrondissement: number;
  duplicatesRemoved: number;
  rejected: RejectedCommune[];
  rejectedByReason: Record<RejectReason, number>;
}

// Mots qui restent en minuscules à l'intérieur d'un nom de commune (« L'Abergement-de-Varey »).
const LOWERCASE_PARTICLES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'et', 'au', 'aux', 'lès', 'lez', 'à',
]);

function toFrenchTitleCase(name: string): string {
  let first = true;
  return name.toLocaleLowerCase('fr-FR').replace(/[^\s'’-]+/g, (word) => {
    const keepLower = !first && LOWERCASE_PARTICLES.has(word);
    first = false;
    return keepLower ? word : word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1);
  });
}

/** Normalise un nom de commune : forme Unicode, espaces, casse. */
export function normalizeName(raw: string | null | undefined): string {
  const name = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  // geo.api.gouv.fr renvoie déjà une casse propre : on ne recase que les noms entièrement en
  // majuscules (autres sources, saisies utilisateur), sans toucher aux noms courts comme « Y ».
  const isAllCaps = name === name.toLocaleUpperCase('fr-FR') && /\p{Lu}{2,}/u.test(name);
  return isAllCaps ? toFrenchTitleCase(name) : name;
}

/** Ramène un code postal sur 5 chiffres (« 1400 » → « 01400 ») ; null s'il est inexploitable. */
export function normalizeCodePostal(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).trim();
  if (/^\d{5}$/.test(digits)) return digits;
  // Zéro initial perdu par un export tableur.
  if (/^\d{4}$/.test(digits)) return digits.padStart(5, '0');
  return null;
}

function parseCentre(centre: RawCommune['centre']): { latitude: number; longitude: number } | RejectReason {
  const coordinates = centre?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 'sans_coordonnees';
  // GeoJSON impose l'ordre [longitude, latitude] : l'inverser placerait Paris dans l'océan Indien.
  const [longitude, latitude] = coordinates as unknown[];
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return 'coordonnees_invalides';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'coordonnees_invalides';
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return 'coordonnees_invalides';
  return { latitude, longitude };
}

/** Nettoie une commune brute : une ligne par code postal valide, ou un motif de rejet. */
export function cleanCommune(raw: RawCommune): CleanedCommune {
  const nom = normalizeName(raw.nom);
  if (!nom) return { rows: [], reason: 'sans_nom' };

  const codesPostaux = [
    ...new Set((raw.codesPostaux ?? []).map(normalizeCodePostal).filter((cp): cp is string => cp !== null)),
  ];
  if (codesPostaux.length === 0) return { rows: [], reason: 'sans_code_postal' };

  const centre = parseCentre(raw.centre);
  if (typeof centre === 'string') return { rows: [], reason: centre };

  return {
    rows: codesPostaux.map((code_postal) => ({
      code_postal,
      nom,
      latitude: centre.latitude,
      longitude: centre.longitude,
    })),
    reason: null,
  };
}

/** Supprime les doublons sur la clé primaire (code_postal, nom) en gardant la première occurrence. */
export function dedupeRows(rows: CommuneRow[]): { rows: CommuneRow[]; removed: number } {
  const byKey = new Map<string, CommuneRow>();
  for (const row of rows) {
    const key = `${row.code_postal}|${row.nom}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return { rows: [...byKey.values()], removed: rows.length - byKey.size };
}

const ARRONDISSEMENT_SUFFIX = /\s+\d+(?:er|e)\s+arrondissement$/i;

/** « Paris 12e Arrondissement » → « Paris » ; null si le nom n'est pas celui d'un arrondissement. */
export function parentCityName(name: string): string | null {
  return ARRONDISSEMENT_SUFFIX.test(name) ? name.replace(ARRONDISSEMENT_SUFFIX, '') : null;
}

/**
 * Donne la priorité aux arrondissements municipaux. L'API renvoie Paris comme une seule commune
 * portant ses 21 codes postaux et un centre unique : toute distance intra-muros serait nulle
 * (le cas de référence du matching est « Paris 12e vs Vincennes »). Pour chaque code postal couvert
 * par un arrondissement, la ligne de la commune globale correspondante est retirée. Les autres
 * communes qui partageraient le code postal ne sont pas touchées.
 */
export function mergeArrondissements(
  communes: CommuneRow[],
  arrondissements: CommuneRow[],
): { rows: CommuneRow[]; overridden: number } {
  // code postal → noms des communes globales à remplacer (ex. « 75012 » → { « Paris » })
  const covered = new Map<string, Set<string>>();
  for (const arrondissement of arrondissements) {
    const parent = parentCityName(arrondissement.nom);
    if (!parent) continue;
    const parents = covered.get(arrondissement.code_postal) ?? new Set<string>();
    parents.add(parent);
    covered.set(arrondissement.code_postal, parents);
  }
  const kept = communes.filter((commune) => !covered.get(commune.code_postal)?.has(commune.nom));
  return { rows: [...kept, ...arrondissements], overridden: communes.length - kept.length };
}

/** Chaîne complète : nettoyage individuel → priorité aux arrondissements → dédoublonnage. */
export function cleanCommunes(rawCommunes: RawCommune[], rawArrondissements: RawCommune[] = []): CleanReport {
  const rejected: RejectedCommune[] = [];
  const rejectedByReason: Record<RejectReason, number> = {
    sans_nom: 0,
    sans_code_postal: 0,
    sans_coordonnees: 0,
    coordonnees_invalides: 0,
  };

  const cleanAll = (raws: RawCommune[]): CommuneRow[] =>
    raws.flatMap((raw) => {
      const { rows, reason } = cleanCommune(raw);
      if (reason) {
        rejected.push({ code: raw.code, nom: (raw.nom ?? '').trim(), reason });
        rejectedByReason[reason] += 1;
      }
      return rows;
    });

  const communes = cleanAll(rawCommunes);
  const arrondissements = cleanAll(rawArrondissements);
  const merged = mergeArrondissements(communes, arrondissements);
  const deduped = dedupeRows(merged.rows);

  return {
    rows: deduped.rows,
    exploded: communes.length + arrondissements.length,
    overriddenByArrondissement: merged.overridden,
    duplicatesRemoved: deduped.removed,
    rejected,
    rejectedByReason,
  };
}
