/**
 * Score de compatibilité agent ↔ mission, sur 100 :
 *
 *   Score = mots-clés (50) + dernières missions (25) + localisation (25)
 *
 * La disponibilité n'apporte aucun point : c'est un filtre éliminatoire (`isAvailable`).
 * Ce module est volontairement pur (aucun accès base, aucune date courante) pour être
 * testé unitairement : le service de matching lui fournit les données déjà chargées.
 */
import type { Experience, Mission, NiveauCompetence, Profile, ProfilCompetence } from '../types';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type MissionForScore = Pick<
  Mission,
  'typeNettoyage' | 'description' | 'competencesRequises' | 'jours' | 'creneau' | 'codePostal'
>;
export type QualifiedSkillForScore = Pick<ProfilCompetence, 'nom' | 'niveau'>;
export type ProfileForScore = Pick<
  Profile,
  'competences' | 'typesNettoyage' | 'joursDisponibles' | 'creneaux' | 'disponible' | 'rayonKm' | 'codePostal'
> & {
  /** Compétences qualifiées (référentiel + niveau). Absentes ou vides : le score ne dépend que du texte libre. */
  competencesQualifiees?: QualifiedSkillForScore[];
};
export type ExperienceForScore = Pick<Experience, 'intitule' | 'typeNettoyage' | 'dateFin'>;

export interface ScoreInput {
  mission: MissionForScore;
  missionCommune: GeoPoint | null;
  profile: ProfileForScore;
  profileCommune: GeoPoint | null;
  experiences: ExperienceForScore[];
}

export interface Score {
  total: number;
  details: {
    motsCles: number;
    experiences: number;
    localisation: number;
    distanceKm: number | null;
  };
}

// Mots vides du français les plus fréquents dans une description de mission : ils ne
// portent aucune compétence et dilueraient le taux de recouvrement.
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'en', 'au', 'aux', 'pour', 'par',
  'sur', 'sous', 'dans', 'avec', 'sans', 'chez', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses',
  'nous', 'vous', 'votre', 'vos', 'notre', 'nos', 'est', 'sont', 'a', 'ont', 'etre', 'avoir',
  'plus', 'tres', 'pas', 'ne', 'que', 'qui', 'dont', 'the',
]);

/**
 * Normalise un texte en mots-clés comparables : minuscules, sans accents, sans ponctuation,
 * sans mots vides, au singulier (règle simple : on retire un « s » ou « x » final).
 * « Nettoyage des vitres » et « nettoyage vitre » donnent le même ensemble.
 */
export function normalizeKeywords(text: string | string[]): Set<string> {
  const joined = Array.isArray(text) ? text.join(' ') : text;
  const words = joined
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // retire les accents décomposés par NFD
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));
  return new Set(words);
}

/** Forme canonique d'un type de nettoyage : « Bureaux » et « bureau » sont le même type. */
function canonicalType(type: string): string {
  return [...normalizeKeywords(type)].sort().join(' ');
}

/**
 * Filtre éliminatoire : l'agent doit être marqué disponible, couvrir tous les jours de la
 * mission et le créneau demandé. Un agent indisponible n'apparaît pas et ne peut pas candidater.
 */
export function isAvailable(profile: ProfileForScore, mission: Pick<Mission, 'jours' | 'creneau'>): boolean {
  if (!profile.disponible) return false;
  const joursOk = mission.jours.every((jour) => profile.joursDisponibles.includes(jour));
  const creneauOk = mission.creneau === null || profile.creneaux.includes(mission.creneau);
  return joursOk && creneauOk;
}

/** Mots-clés requis par la mission, avec leur poids : 2 pour les compétences explicites et le type, 1 pour la description. */
function requiredKeywords(mission: MissionForScore): Map<string, number> {
  const required = new Map<string, number>();
  for (const word of normalizeKeywords([...mission.competencesRequises, mission.typeNettoyage])) {
    required.set(word, 2);
  }
  for (const word of normalizeKeywords(mission.description ?? '')) {
    if (!required.has(word)) required.set(word, 1);
  }
  return required;
}

/**
 * Part de la contribution d'un mot-clé apporté par une compétence qualifiée, selon le niveau déclaré.
 * Un EXPERT vaut autant qu'une compétence saisie en texte libre ; un DEBUTANT en vaut la moitié.
 */
const NIVEAU_COEFFICIENT: Record<NiveauCompetence, number> = {
  DEBUTANT: 0.5,
  INTERMEDIAIRE: 0.7,
  CONFIRME: 0.85,
  EXPERT: 1,
};

/**
 * Mots-clés détenus par le profil, avec leur coefficient (0 à 1) : 1 pour le texte libre
 * (compétences et types de nettoyage), le coefficient du niveau pour une compétence qualifiée.
 * Un mot présent dans plusieurs sources garde le meilleur coefficient : qualifier une compétence
 * ne fait jamais baisser un score.
 */
function ownedKeywords(profile: ProfileForScore): Map<string, number> {
  const owned = new Map<string, number>();
  for (const word of normalizeKeywords([...profile.competences, ...profile.typesNettoyage])) {
    owned.set(word, 1);
  }
  for (const { nom, niveau } of profile.competencesQualifiees ?? []) {
    const coefficient = NIVEAU_COEFFICIENT[niveau];
    for (const word of normalizeKeywords(nom)) {
      owned.set(word, Math.max(owned.get(word) ?? 0, coefficient));
    }
  }
  return owned;
}

/** Mots-clés (50) : taux de recouvrement pondéré des mots-clés requis retrouvés dans le profil. */
function keywordScore(required: Map<string, number>, profile: ProfileForScore): number {
  const owned = ownedKeywords(profile);
  let totalWeight = 0;
  let foundWeight = 0;
  for (const [word, weight] of required) {
    totalWeight += weight;
    foundWeight += weight * (owned.get(word) ?? 0);
  }
  return totalWeight === 0 ? 0 : Math.round((50 * foundWeight) / totalWeight);
}

/**
 * Dernières missions (25) : sur les 5 expériences les plus récentes, +15 si l'une est du même
 * type de nettoyage, +10 si l'une partage des mots-clés avec la mission. Le récent vaut plus que
 * l'ancien : la plus récente compte à 100 %, puis 80 %, 60 %, 40 %, 20 %. On garde la meilleure
 * expérience pour chaque critère.
 */
function experienceScore(
  mission: MissionForScore,
  required: Map<string, number>,
  experiences: ExperienceForScore[],
): number {
  const missionType = canonicalType(mission.typeNettoyage);
  // Une expérience sans date de fin est en cours : c'est la plus récente.
  const recent = [...experiences]
    .sort((a, b) => (b.dateFin ?? '9999').localeCompare(a.dateFin ?? '9999'))
    .slice(0, 5);

  let typePoints = 0;
  let keywordPoints = 0;
  recent.forEach((experience, rank) => {
    const recency = 1 - rank * 0.2;
    if (experience.typeNettoyage && canonicalType(experience.typeNettoyage) === missionType) {
      typePoints = Math.max(typePoints, 15 * recency);
    }
    const words = normalizeKeywords([experience.intitule, experience.typeNettoyage ?? '']);
    if ([...words].some((word) => required.has(word))) {
      keywordPoints = Math.max(keywordPoints, 10 * recency);
    }
  });
  return Math.round(typePoints + keywordPoints);
}

/** Distance orthodromique entre deux points, en km (formule de haversine, rayon terrestre moyen). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Localisation (25) : 25 pts si la mission est dans le rayon de l'agent, puis dégressif
 * linéairement jusqu'à 0 au double du rayon. Sans coordonnées connues, seul un code postal
 * identique rapporte des points.
 */
function locationScore(
  profile: ProfileForScore,
  profileCommune: GeoPoint | null,
  mission: MissionForScore,
  missionCommune: GeoPoint | null,
): { points: number; distanceKm: number | null } {
  if (profile.codePostal !== null && profile.codePostal === mission.codePostal) {
    return { points: 25, distanceKm: 0 };
  }
  if (!profileCommune || !missionCommune) return { points: 0, distanceKm: null };

  const distance = haversineKm(profileCommune, missionCommune);
  const distanceKm = Math.round(distance * 10) / 10;
  const rayon = profile.rayonKm;
  if (distance <= rayon) return { points: 25, distanceKm };
  if (distance >= 2 * rayon) return { points: 0, distanceKm };
  return { points: Math.round(25 * (1 - (distance - rayon) / rayon)), distanceKm };
}

export function computeScore(input: ScoreInput): Score {
  const required = requiredKeywords(input.mission);
  const motsCles = keywordScore(required, input.profile);
  const experiences = experienceScore(input.mission, required, input.experiences);
  const localisation = locationScore(input.profile, input.profileCommune, input.mission, input.missionCommune);

  return {
    total: motsCles + experiences + localisation.points,
    details: { motsCles, experiences, localisation: localisation.points, distanceKm: localisation.distanceKm },
  };
}
