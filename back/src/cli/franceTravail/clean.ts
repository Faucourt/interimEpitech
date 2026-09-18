/**
 * Nettoyage des offres France Travail (API Offres d'emploi v2) — fonctions pures, sans I/O.
 *
 * Transformations appliquées :
 *  - libellés : intitulés débarrassés des mentions de genre « (H/F) », espaces et casse normalisés ;
 *  - dates : ISO 8601 de l'API ou « JJ/MM/AAAA » d'un export tableur → Date, invalides écartées ;
 *  - lieux : code postal (ou code INSEE, ou libellé « 75 - PARIS 12 ») → département → région ;
 *  - dédoublonnage : par identifiant, puis par empreinte pour attraper les republications ;
 *  - agrégation par (code ROME, région, département, année) au format de `donnees_france_travail`.
 */
import { normalizeCodePostal } from '../communes/clean';
import { DEPARTEMENTS, type Departement } from './departements';

/** Champs utilisés d'une offre telle que renvoyée par /offres/search. */
export interface RawOffre {
  id?: string;
  intitule?: string;
  dateCreation?: string;
  romeCode?: string;
  romeLibelle?: string;
  nombrePostes?: number;
  entreprise?: { nom?: string } | null;
  lieuTravail?: { libelle?: string; codePostal?: string; commune?: string } | null;
}

export interface CleanOffer {
  id: string;
  intitule: string;
  codeRome: string;
  libelleMetier: string;
  departement: string;
  /** « 75 - Paris » : le département tient lieu de bassin d'emploi. */
  bassinEmploi: string;
  region: string;
  entreprise: string | null;
  nombrePostes: number;
  dateCreation: Date;
  annee: number;
}

export type OfferRejectReason = 'sans_identifiant' | 'sans_intitule' | 'sans_code_rome' | 'date_invalide' | 'lieu_inconnu';

export interface RejectedOffer {
  id?: string;
  intitule?: string;
  reason: OfferRejectReason;
}

/** Une ligne de `donnees_france_travail` (hors id et importe_le). */
export interface TendanceRow {
  code_rome: string;
  libelle_metier: string;
  region: string;
  bassin_emploi: string;
  projets_recrutement: number;
  difficulte_recrutement: number;
  annee: number;
}

export interface OfferCleanReport {
  rows: TendanceRow[];
  offers: CleanOffer[];
  duplicatesRemoved: number;
  rejected: RejectedOffer[];
  rejectedByReason: Record<OfferRejectReason, number>;
}

/**
 * Au-delà de ce délai, une offre encore en ligne est comptée comme difficile à pourvoir.
 * `difficulte_recrutement` est la part de ces offres dans le groupe (0 à 1) : un proxy de tension,
 * l'API des offres ne publiant pas l'indicateur de difficulté de l'enquête BMO.
 */
export const HARD_TO_FILL_AFTER_DAYS = 30;

// « (H/F) », « H/F », « F/H », « H-F », « (M/F) »… avec limites de mot pour épargner « chef-fromager ».
const GENDER_MENTION = /\(?\b[hfm]\s*[/-]\s*[hfm]\b\)?/gi;
const EDGE_PUNCTUATION = /^[\s\-–—:,.;]+|[\s\-–—:,.;]+$/g;

/** Normalise un intitulé de poste : mentions de genre retirées, espaces et casse cohérents. */
export function normalizeJobTitle(raw: string | null | undefined): string {
  const title = (raw ?? '')
    .normalize('NFC')
    .replace(GENDER_MENTION, ' ')
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim();
  if (!title) return '';
  // Un intitulé tout en majuscules passe en casse de phrase ; les autres gardent leurs sigles.
  const isAllCaps = title === title.toLocaleUpperCase('fr-FR') && /\p{Lu}{2,}/u.test(title);
  return isAllCaps ? title.charAt(0) + title.slice(1).toLocaleLowerCase('fr-FR') : title;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;
const FRENCH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Accepte l'ISO 8601 de l'API et le « JJ/MM/AAAA » des exports tableur ; null si invalide. */
export function parseOfferDate(raw: string | null | undefined): Date | null {
  const value = (raw ?? '').trim();
  const french = FRENCH_DATE.exec(value);
  if (!french && !ISO_DATE.test(value)) return null;

  const date = french
    ? new Date(Date.UTC(Number(french[3]), Number(french[2]) - 1, Number(french[1])))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Un « 31/02 » déborde silencieusement sur mars : on le rejette.
  if (french && (date.getUTCMonth() !== Number(french[2]) - 1 || date.getUTCDate() !== Number(french[1]))) {
    return null;
  }
  return date;
}

/** Code postal → code département (« 75012 » → « 75 », « 20000 » → « 2A », « 97400 » → « 974 »). */
export function departementFromCodePostal(raw: string | number | null | undefined): string | null {
  const codePostal = normalizeCodePostal(raw);
  if (!codePostal) return null;
  // Outre-mer : trois chiffres.
  if (codePostal.startsWith('97') || codePostal.startsWith('98')) return codePostal.slice(0, 3);
  // Corse : 200xx-201xx au sud (2A), 202xx et au-delà au nord (2B).
  if (codePostal.startsWith('20')) return Number(codePostal) < 20200 ? '2A' : '2B';
  return codePostal.slice(0, 2);
}

/** Code INSEE commune (« 75112 », « 2A004 », « 97101 ») → code département. */
export function departementFromCodeInsee(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  if (!/^(?:\d{5}|2[AB]\d{3})$/.test(code)) return null;
  return code.startsWith('97') || code.startsWith('98') ? code.slice(0, 3) : code.slice(0, 2);
}

/** Libellé de lieu France Travail (« 75 - PARIS 12 », « 2A - AJACCIO ») → code département. */
export function departementFromLibelle(raw: string | null | undefined): string | null {
  const match = /^\s*(\d{2,3}|2[AB])\s*-/i.exec(raw ?? '');
  return match ? match[1].toUpperCase() : null;
}

/** Résout le département d'un lieu de travail : code postal, puis code INSEE, puis libellé. */
export function resolveDepartement(lieu: RawOffre['lieuTravail']): Departement | null {
  if (!lieu) return null;
  const code =
    departementFromCodePostal(lieu.codePostal) ??
    departementFromCodeInsee(lieu.commune) ??
    departementFromLibelle(lieu.libelle);
  return code ? (DEPARTEMENTS.get(code) ?? null) : null;
}

export function regionFromDepartement(code: string): string | null {
  return DEPARTEMENTS.get(code)?.region ?? null;
}

/** Nettoie une offre brute, ou renvoie le motif de rejet. */
export function cleanOffer(raw: RawOffre): { offer: CleanOffer; reason: null } | { offer: null; reason: OfferRejectReason } {
  const reject = (reason: OfferRejectReason) => ({ offer: null, reason });

  const id = (raw.id ?? '').trim();
  if (!id) return reject('sans_identifiant');

  const intitule = normalizeJobTitle(raw.intitule);
  if (!intitule) return reject('sans_intitule');

  const codeRome = (raw.romeCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]\d{4}$/.test(codeRome)) return reject('sans_code_rome');

  const dateCreation = parseOfferDate(raw.dateCreation);
  if (!dateCreation) return reject('date_invalide');

  const departement = resolveDepartement(raw.lieuTravail);
  if (!departement) return reject('lieu_inconnu');

  const nombrePostes = raw.nombrePostes;
  return {
    offer: {
      id,
      intitule,
      codeRome,
      libelleMetier: normalizeJobTitle(raw.romeLibelle) || intitule,
      departement: departement.code,
      bassinEmploi: `${departement.code} - ${departement.nom}`,
      region: departement.region,
      entreprise: raw.entreprise?.nom?.trim() || null,
      nombrePostes: Number.isInteger(nombrePostes) && (nombrePostes as number) > 0 ? (nombrePostes as number) : 1,
      dateCreation,
      annee: dateCreation.getUTCFullYear(),
    },
    reason: null,
  };
}

/**
 * Dédoublonne par identifiant, puis par empreinte (intitulé + entreprise + département + jour de
 * création) pour attraper les republications. L'empreinte n'est utilisée que si l'entreprise est
 * connue : deux employeurs anonymes peuvent publier le même intitulé le même jour.
 */
export function dedupeOffers(offers: CleanOffer[]): { offers: CleanOffer[]; removed: number } {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  const kept: CleanOffer[] = [];
  for (const offer of offers) {
    if (ids.has(offer.id)) continue;
    const fingerprint = offer.entreprise
      ? [
          offer.intitule.toLocaleLowerCase('fr-FR'),
          offer.entreprise.toLocaleLowerCase('fr-FR'),
          offer.departement,
          offer.dateCreation.toISOString().slice(0, 10),
        ].join('|')
      : null;
    if (fingerprint && fingerprints.has(fingerprint)) continue;
    ids.add(offer.id);
    if (fingerprint) fingerprints.add(fingerprint);
    kept.push(offer);
  }
  return { offers: kept, removed: offers.length - kept.length };
}

/** Agrège les offres au grain de la table : (code ROME, région, département, année). */
export function aggregateOffers(offers: CleanOffer[], now: Date = new Date()): TendanceRow[] {
  const threshold = now.getTime() - HARD_TO_FILL_AFTER_DAYS * 86_400_000;
  const groups = new Map<string, { row: TendanceRow; total: number; hardToFill: number }>();

  for (const offer of offers) {
    const key = [offer.codeRome, offer.region, offer.bassinEmploi, offer.annee].join('|');
    let group = groups.get(key);
    if (!group) {
      group = {
        row: {
          code_rome: offer.codeRome,
          libelle_metier: offer.libelleMetier,
          region: offer.region,
          bassin_emploi: offer.bassinEmploi,
          projets_recrutement: 0,
          difficulte_recrutement: 0,
          annee: offer.annee,
        },
        total: 0,
        hardToFill: 0,
      };
      groups.set(key, group);
    }
    group.row.projets_recrutement += offer.nombrePostes;
    group.total += 1;
    if (offer.dateCreation.getTime() < threshold) group.hardToFill += 1;
  }

  return [...groups.values()]
    .map(({ row, total, hardToFill }) => ({
      ...row,
      difficulte_recrutement: Math.round((hardToFill / total) * 100) / 100,
    }))
    .sort((a, b) => b.projets_recrutement - a.projets_recrutement);
}

/** Chaîne complète : nettoyage individuel → dédoublonnage → agrégation. */
export function cleanOffers(raws: RawOffre[], now: Date = new Date()): OfferCleanReport {
  const rejected: RejectedOffer[] = [];
  const rejectedByReason: Record<OfferRejectReason, number> = {
    sans_identifiant: 0,
    sans_intitule: 0,
    sans_code_rome: 0,
    date_invalide: 0,
    lieu_inconnu: 0,
  };

  const cleaned = raws.flatMap((raw) => {
    const { offer, reason } = cleanOffer(raw);
    if (reason) {
      rejected.push({ id: raw.id, intitule: raw.intitule, reason });
      rejectedByReason[reason] += 1;
      return [];
    }
    return [offer];
  });

  const deduped = dedupeOffers(cleaned);
  return {
    rows: aggregateOffers(deduped.offers, now),
    offers: deduped.offers,
    duplicatesRemoved: deduped.removed,
    rejected,
    rejectedByReason,
  };
}
